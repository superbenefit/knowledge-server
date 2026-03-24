/**
 * Bootstrap Sync — Full initial sync of the knowledge base.
 *
 * Shallow-clones the GitHub repo locally, pre-filters to only those
 * with publish: true (and draft !== true), then triggers KnowledgeSyncWorkflow
 * instances via `wrangler workflows trigger` in batches.
 *
 * Uses a local clone instead of the GitHub API to avoid rate limits.
 *
 * Usage:
 *   npx tsx scripts/bootstrap-sync.ts              # Full sync
 *   npx tsx scripts/bootstrap-sync.ts --dry-run    # Preview only
 *   npx tsx scripts/bootstrap-sync.ts --batch-size 100
 *
 * Environment (from .dev.vars or shell):
 *   GITHUB_TOKEN  — GitHub auth (for private repo cloning)
 *   GITHUB_REPO   — owner/repo format
 *
 * Wrangler auth must be configured (wrangler login or CLOUDFLARE_API_TOKEN).
 */

import { readFileSync, existsSync, readdirSync, rmSync, mkdtempSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

// Import sync utilities from src/ — pure functions, Node 22 compatible
import { isExcluded } from '../src/sync/github';
import { parseMarkdown, shouldSync } from '../src/sync/parser';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DEFAULT_BATCH_SIZE = 20;

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
// Local clone operations
// ---------------------------------------------------------------------------

function cloneRepo(repo: string, token: string): string {
  const cloneDir = mkdtempSync(join(tmpdir(), 'kb-bootstrap-'));
  console.log(`Cloning ${repo} (shallow, depth=1)...`);

  try {
    execSync(
      `git clone --depth 1 --branch main "https://x-access-token:${token}@github.com/${repo}.git" "${cloneDir}"`,
      { stdio: 'pipe' },
    );
  } catch (err: unknown) {
    const msg = (err as any)?.stderr?.toString() || (err as Error)?.message || 'Unknown error';
    // Sanitize error message to avoid leaking the token
    const safe = msg.replace(token, '***');
    throw new Error(`Failed to clone repository: ${safe}`);
  }

  return cloneDir;
}

function getCommitSha(cloneDir: string): string {
  return execSync('git rev-parse HEAD', { cwd: cloneDir, encoding: 'utf-8' }).trim();
}

function findMdFiles(cloneDir: string): string[] {
  return (readdirSync(cloneDir, { recursive: true, encoding: 'utf-8' }) as string[])
    .map((f) => f.replace(/\\/g, '/')) // Normalize Windows backslashes
    .filter((f) => f.endsWith('.md') && !f.startsWith('.git/') && !isExcluded(f));
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
    // Force bash on Windows — cmd.exe can't handle JSON with double quotes in args
    shell: process.platform === 'win32' ? 'bash' : undefined,
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
  if (dryRun) console.log('DRY RUN — no workflows will be triggered');
  console.log();

  // Step 1: Shallow clone the repo (avoids GitHub API rate limits)
  const cloneDir = cloneRepo(repo, token);

  try {
    const commitSha = getCommitSha(cloneDir);
    console.log(`Commit: ${commitSha}\n`);

    // Step 2: Find .md files via local directory walk
    const candidates = findMdFiles(cloneDir);
    console.log(`Candidate .md files: ${candidates.length}`);

    if (candidates.length === 0) {
      console.log('No candidate files found.');
      return;
    }

    // Step 3: Pre-filter — read each file from disk and check shouldSync()
    console.log(`\nPre-filtering: checking frontmatter for ${candidates.length} files...`);
    const qualifying: string[] = [];
    let skipped = 0;
    let errors = 0;

    for (const filePath of candidates) {
      try {
        const fullPath = resolve(cloneDir, filePath);
        const raw = readFileSync(fullPath, 'utf-8');
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
        console.error(`  Error reading ${filePath}: ${err instanceof Error ? err.message : err}`);
      }
    }

    console.log(`\nPre-filter complete:`);
    console.log(`  Qualifying (publish: true): ${qualifying.length}`);
    console.log(`  Skipped (unpublished/draft/parse error): ${skipped}`);
    if (errors > 0) console.log(`  Errors: ${errors}`);

    if (qualifying.length === 0) {
      console.log('\nNo qualifying files to sync.');
      return;
    }

    // Step 4: Batch and trigger
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
  } finally {
    // Clean up clone directory
    console.log('\nCleaning up temporary clone...');
    rmSync(cloneDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error('Bootstrap failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
