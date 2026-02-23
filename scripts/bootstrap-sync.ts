/**
 * Bootstrap Sync — Full initial sync of the knowledge base.
 *
 * Fetches all .md files from the GitHub repo, pre-filters to only those
 * with publish: true (and draft !== true), then triggers KnowledgeSyncWorkflow
 * instances via `wrangler workflows trigger` in batches.
 *
 * Usage:
 *   npx tsx scripts/bootstrap-sync.ts              # Full sync
 *   npx tsx scripts/bootstrap-sync.ts --dry-run    # Preview only
 *   npx tsx scripts/bootstrap-sync.ts --batch-size 100
 *
 * Environment (from .dev.vars or shell):
 *   GITHUB_TOKEN  — GitHub API auth
 *   GITHUB_REPO   — owner/repo format
 *
 * Wrangler auth must be configured (wrangler login or CLOUDFLARE_API_TOKEN).
 */

import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Import sync utilities from src/ — pure functions, Node 22 compatible
import { fetchFileContent, isExcluded } from '../src/sync/github';
import { parseMarkdown, shouldSync } from '../src/sync/parser';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DEFAULT_BATCH_SIZE = 50;
const CONCURRENCY = 20;

// ---------------------------------------------------------------------------
// .dev.vars loader
// ---------------------------------------------------------------------------

function loadDevVars(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const content = readFileSync(path, 'utf-8');
  const vars: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq > 0) vars[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return vars;
}

function getEnv(key: string, devVars: Record<string, string>): string {
  const value = process.env[key] || devVars[key];
  if (!value) {
    console.error(`Missing ${key}. Set it in .dev.vars or as an environment variable.`);
    process.exit(1);
  }
  return value;
}

// ---------------------------------------------------------------------------
// GitHub API
// ---------------------------------------------------------------------------

interface GitTreeEntry {
  path: string;
  mode: string;
  type: 'blob' | 'tree';
  sha: string;
  size?: number;
}

interface GitTreeResponse {
  sha: string;
  tree: GitTreeEntry[];
  truncated: boolean;
}

interface GitRefResponse {
  object: { sha: string };
}

async function githubGet<T>(url: string, token: string): Promise<T> {
  const resp = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'superbenefit-knowledge-server-bootstrap',
    },
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`GitHub API ${resp.status}: ${text}`);
  }
  return resp.json() as Promise<T>;
}

async function getMainCommitSha(repo: string, token: string): Promise<string> {
  const ref = await githubGet<GitRefResponse>(
    `https://api.github.com/repos/${repo}/git/ref/heads/main`,
    token,
  );
  return ref.object.sha;
}

async function getFileTree(repo: string, commitSha: string, token: string): Promise<GitTreeEntry[]> {
  const tree = await githubGet<GitTreeResponse>(
    `https://api.github.com/repos/${repo}/git/trees/${commitSha}?recursive=1`,
    token,
  );
  if (tree.truncated) {
    console.warn('Warning: GitHub tree response was truncated (>100k entries). Some files may be missing.');
  }
  return tree.tree;
}

// ---------------------------------------------------------------------------
// Parallel execution with concurrency limit
// ---------------------------------------------------------------------------

async function parallelForEach<T>(
  items: T[],
  fn: (item: T, index: number) => Promise<void>,
  concurrency: number,
): Promise<void> {
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const i = index++;
      await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
}

// ---------------------------------------------------------------------------
// Batching
// ---------------------------------------------------------------------------

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// ---------------------------------------------------------------------------
// Workflow trigger
// ---------------------------------------------------------------------------

function triggerWorkflow(changedFiles: string[], commitSha: string): void {
  const params = JSON.stringify({ changedFiles, deletedFiles: [], commitSha });
  // Escape single quotes for shell safety
  const escaped = params.replace(/'/g, "'\\''");
  execSync(`npx wrangler workflows trigger knowledge-sync-workflow '${escaped}'`, {
    stdio: 'inherit',
    cwd: resolve(__dirname, '..'),
  });
}

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

function parseArgs(): { dryRun: boolean; batchSize: number } {
  const args = process.argv.slice(2);
  let dryRun = false;
  let batchSize = DEFAULT_BATCH_SIZE;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dry-run') {
      dryRun = true;
    } else if (args[i] === '--batch-size' && args[i + 1]) {
      batchSize = parseInt(args[i + 1], 10);
      if (isNaN(batchSize) || batchSize < 1 || batchSize > 500) {
        console.error('--batch-size must be between 1 and 500');
        process.exit(1);
      }
      i++;
    }
  }

  return { dryRun, batchSize };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { dryRun, batchSize } = parseArgs();
  const projectRoot = resolve(__dirname, '..');
  const devVars = loadDevVars(resolve(projectRoot, '.dev.vars'));

  const token = getEnv('GITHUB_TOKEN', devVars);
  const repo = getEnv('GITHUB_REPO', devVars);

  console.log(`Repository: ${repo}`);
  console.log(`Batch size: ${batchSize}`);
  console.log(`Concurrency: ${CONCURRENCY}`);
  if (dryRun) console.log('DRY RUN — no workflows will be triggered');
  console.log();

  // Step 1: Get latest commit SHA
  console.log('Fetching latest commit SHA from main...');
  const commitSha = await getMainCommitSha(repo, token);
  console.log(`Commit: ${commitSha}\n`);

  // Step 2: Fetch full file tree
  console.log('Fetching file tree...');
  const tree = await getFileTree(repo, commitSha, token);
  const allFiles = tree.filter((e) => e.type === 'blob').map((e) => e.path);
  console.log(`Total files in repo: ${allFiles.length}`);

  // Step 3: Filter to .md files, exclude non-content paths
  const candidates = allFiles.filter((f) => f.endsWith('.md') && !isExcluded(f));
  console.log(`Candidate .md files: ${candidates.length}`);

  if (candidates.length === 0) {
    console.log('No candidate files found.');
    return;
  }

  // Step 4: Pre-filter — fetch each file and check shouldSync()
  console.log(`\nPre-filtering: fetching frontmatter for ${candidates.length} files (${CONCURRENCY} concurrent)...`);
  const qualifying: string[] = [];
  let skipped = 0;
  let errors = 0;
  let checked = 0;

  await parallelForEach(candidates, async (filePath) => {
    try {
      const raw = await fetchFileContent(filePath, commitSha, repo, token);
      const parsed = parseMarkdown(raw);

      if (parsed.parseError) {
        skipped++;
      } else if (!shouldSync(parsed.frontmatter)) {
        skipped++;
      } else {
        qualifying.push(filePath);
      }
    } catch (err) {
      errors++;
      console.error(`  Error fetching ${filePath}: ${err instanceof Error ? err.message : err}`);
    }

    checked++;
    if (checked % 100 === 0) {
      console.log(`  ... checked ${checked}/${candidates.length}`);
    }
  }, CONCURRENCY);

  console.log(`\nPre-filter complete:`);
  console.log(`  Qualifying (publish: true): ${qualifying.length}`);
  console.log(`  Skipped (unpublished/draft/parse error): ${skipped}`);
  if (errors > 0) console.log(`  Errors: ${errors}`);

  if (qualifying.length === 0) {
    console.log('\nNo qualifying files to sync.');
    return;
  }

  // Step 5: Batch and trigger
  const batches = chunk(qualifying, batchSize);
  console.log(`\nBatches: ${batches.length} (${batchSize} files each)\n`);

  if (dryRun) {
    console.log('Files that would be synced:');
    for (const file of qualifying) {
      console.log(`  ${file}`);
    }
    console.log(`\nDry run complete. ${qualifying.length} qualifying files in ${batches.length} batches.`);
    return;
  }

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(`Triggering batch ${i + 1}/${batches.length} (${batch.length} files)...`);
    try {
      triggerWorkflow(batch, commitSha);
    } catch (err) {
      console.error(`Failed to trigger batch ${i + 1}:`, err instanceof Error ? err.message : err);
      console.error('Stopping. Remaining batches were not triggered.');
      process.exit(1);
    }
  }

  console.log(`\nBootstrap complete: triggered ${batches.length} workflows for ${qualifying.length} files.`);
  console.log('Monitor progress: npx wrangler workflows instances list knowledge-sync-workflow');
}

main().catch((err) => {
  console.error('Bootstrap failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
