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
  const url = `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(filePath)}?ref=${commitSha}`;
  const resp = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'superbenefit-knowledge-server',
    },
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
    return atob(data.content);
  }

  // Shouldn't happen for files under 1MB, but handle gracefully
  return data.content;
}
