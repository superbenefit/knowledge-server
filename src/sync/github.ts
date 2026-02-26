/**
 * GitHub API helpers for the sync workflow.
 *
 * - Webhook signature verification (HMAC-SHA256)
 * - File content fetching via Contents API
 * - Path exclusion rules
 */

// Paths that should never be synced (templates, config, tooling)
const EXCLUDED_PREFIXES = ['tools/', 'templates/', '.obsidian/', '.github/'];
const EXCLUDED_FILES = ['README.md', 'LICENSE.md', 'CONTRIBUTING.md'];

/**
 * Check whether a file path should be excluded from sync.
 */
export function isExcluded(filePath: string): boolean {
  if (EXCLUDED_PREFIXES.some((prefix) => filePath.startsWith(prefix))) {
    return true;
  }
  const filename = filePath.split('/').pop() || '';
  if (EXCLUDED_FILES.includes(filename)) {
    return true;
  }
  return false;
}

/**
 * Verify a GitHub webhook signature (HMAC-SHA256).
 *
 * The signature header is in the form `sha256=<hex>`.
 */
export async function verifyWebhookSignature(
  body: string,
  signatureHeader: string | null,
  secret: string,
): Promise<boolean> {
  if (!signatureHeader) return false;

  const parts = signatureHeader.split('=');
  if (parts.length !== 2 || parts[0] !== 'sha256') return false;
  const receivedHex = parts[1];

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  const expectedHex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // Constant-time comparison
  if (receivedHex.length !== expectedHex.length) return false;
  let mismatch = 0;
  for (let i = 0; i < receivedHex.length; i++) {
    mismatch |= receivedHex.charCodeAt(i) ^ expectedHex.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Fetch raw file content from the GitHub Contents API.
 *
 * Returns the decoded UTF-8 content string.
 * Throws on non-2xx responses (caller handles retry logic via workflow steps).
 */
export async function fetchFileContent(
  filePath: string,
  commitSha: string,
  repo: string,
  token: string,
): Promise<string> {
  // Encode each path segment individually — slashes must remain literal
  const encodedPath = filePath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  const url = `https://api.github.com/repos/${repo}/contents/${encodedPath}?ref=${commitSha}`;
  const resp = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'superbenefit-knowledge-server',
    },
    // Security: Timeout to prevent hanging on slow/unresponsive API
    signal: AbortSignal.timeout(10000),
  });

  if (!resp.ok) {
    const text = await resp.text();
    const err = new Error(`GitHub API ${resp.status}: ${text}`);
    // Attach status for the workflow to decide retry vs non-retry
    (err as any).status = resp.status;
    throw err;
  }

  const data = (await resp.json()) as { content: string; encoding: string };

  if (data.encoding === 'base64') {
    // GitHub returns base64 with embedded newlines (line-wrapped);
    // atob() does not tolerate whitespace, so strip it first
    return atob(data.content.replace(/\s/g, ''));
  }

  // Shouldn't happen for files under 1MB, but handle gracefully
  return data.content;
}

// ---------------------------------------------------------------------------
// Binary content helpers (attachments)
// ---------------------------------------------------------------------------

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
};

/**
 * Map a file path to a MIME type based on its extension.
 * Falls back to `application/octet-stream` for unknown extensions.
 */
export function getMimeType(filePath: string): string {
  const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

/**
 * Fetch binary file content from the GitHub Contents API (raw mode).
 *
 * Uses `Accept: application/vnd.github.v3.raw` to get the raw binary
 * directly, avoiding base64 encoding overhead.
 *
 * For files that are too large for the Contents API (>100 MB), falls back
 * to the Git Blobs API via the recursive tree endpoint.
 */
export async function fetchBinaryContent(
  filePath: string,
  commitSha: string,
  repo: string,
  token: string,
): Promise<ArrayBuffer> {
  const encodedPath = filePath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  const url = `https://api.github.com/repos/${repo}/contents/${encodedPath}?ref=${commitSha}`;

  const resp = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3.raw',
      'User-Agent': 'superbenefit-knowledge-server',
    },
    signal: AbortSignal.timeout(30000),
  });

  if (resp.ok) {
    return resp.arrayBuffer();
  }

  // On 403 with "too large" hint, fall back to Git Blobs API
  if (resp.status === 403) {
    const text = await resp.text();
    if (text.toLowerCase().includes('too large')) {
      return fetchBinaryViaBlob(filePath, commitSha, repo, token);
    }
    const err = new Error(`GitHub API 403: ${text}`);
    (err as any).status = 403;
    throw err;
  }

  if (resp.status === 404) {
    const err = new Error(`Attachment not found: ${filePath}`);
    (err as any).status = 404;
    throw err;
  }

  const text = await resp.text();
  const err = new Error(`GitHub API ${resp.status}: ${text}`);
  (err as any).status = resp.status;
  throw err;
}

/**
 * Fallback: fetch a binary file via Git Trees + Blobs API when the
 * Contents API rejects it for being too large.
 */
async function fetchBinaryViaBlob(
  filePath: string,
  commitSha: string,
  repo: string,
  token: string,
): Promise<ArrayBuffer> {
  const commonHeaders = {
    Authorization: `Bearer ${token}`,
    'User-Agent': 'superbenefit-knowledge-server',
  };

  // Step 1: Get recursive tree for commit
  const treeUrl = `https://api.github.com/repos/${repo}/git/trees/${commitSha}?recursive=1`;
  const treeResp = await fetch(treeUrl, {
    headers: {
      ...commonHeaders,
      Accept: 'application/vnd.github.v3+json',
    },
    signal: AbortSignal.timeout(30000),
  });

  if (!treeResp.ok) {
    const text = await treeResp.text();
    throw new Error(`GitHub Trees API ${treeResp.status}: ${text}`);
  }

  const treeData = (await treeResp.json()) as {
    tree: Array<{ path: string; sha: string; type: string }>;
  };

  // Step 2: Find the blob SHA for the file path
  const entry = treeData.tree.find((e) => e.path === filePath && e.type === 'blob');
  if (!entry) {
    const err = new Error(`File not found in tree: ${filePath}`);
    (err as any).status = 404;
    throw err;
  }

  // Step 3: Fetch blob with raw accept header
  const blobUrl = `https://api.github.com/repos/${repo}/git/blobs/${entry.sha}`;
  const blobResp = await fetch(blobUrl, {
    headers: {
      ...commonHeaders,
      Accept: 'application/vnd.github.v3.raw',
    },
    signal: AbortSignal.timeout(30000),
  });

  if (!blobResp.ok) {
    const text = await blobResp.text();
    throw new Error(`GitHub Blobs API ${blobResp.status}: ${text}`);
  }

  return blobResp.arrayBuffer();
}
