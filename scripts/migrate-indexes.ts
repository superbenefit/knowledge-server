/**
 * Migrate index documents from content/index/ to indexes/ R2 prefix.
 *
 * For each object under content/index/:
 *   1. Reads the JSON document
 *   2. Writes it to indexes/{id}.json
 *   3. Deletes the old content/index/{id}.json key
 *   4. Deletes any corresponding Vectorize entry (index docs are structural, not semantic)
 *
 * Idempotent: safe to run multiple times. If an object already exists at the
 * new key, it will be overwritten. Missing source objects are skipped.
 *
 * Usage:
 *   npx wrangler dev --remote -- --migrate-indexes   # (not used directly)
 *
 * Run via wrangler script execution:
 *   npx tsx scripts/migrate-indexes.ts
 *   npx tsx scripts/migrate-indexes.ts --dry-run
 *
 * Requires wrangler auth (wrangler login or CLOUDFLARE_API_TOKEN).
 */

import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const dryRun = process.argv.includes('--dry-run');

// ---------------------------------------------------------------------------
// Wrangler helpers — shell out to wrangler for R2 + Vectorize operations
// ---------------------------------------------------------------------------

function wrangler(args: string): string {
  return execSync(`npx wrangler ${args}`, {
    cwd: projectRoot,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

function r2List(prefix: string): string[] {
  try {
    const output = wrangler(`r2 object list superbenefit-knowledge --prefix "${prefix}" --remote`);
    // wrangler r2 object list returns JSON array of objects
    const parsed = JSON.parse(output);
    if (Array.isArray(parsed)) {
      return parsed.map((obj: { key: string }) => obj.key);
    }
    return [];
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // If the prefix doesn't exist or is empty, wrangler may return empty
    if (msg.includes('No objects found') || msg.includes('[]')) {
      return [];
    }
    throw err;
  }
}

function r2Get(key: string): string {
  return wrangler(`r2 object get superbenefit-knowledge/${key} --remote --pipe`);
}

function r2Put(key: string, body: string): void {
  execSync(`npx wrangler r2 object put superbenefit-knowledge/${key} --remote --pipe`, {
    cwd: projectRoot,
    input: body,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

function r2Delete(key: string): void {
  wrangler(`r2 object delete superbenefit-knowledge/${key} --remote`);
}

function vectorizeDeleteByIds(ids: string[]): void {
  if (ids.length === 0) return;
  const idsJson = JSON.stringify(ids);
  wrangler(`vectorize delete-vectors superbenefit-knowledge-idx --ids='${idsJson}'`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('=== Index Document Migration ===');
  console.log(`Moving documents from content/index/ to indexes/`);
  if (dryRun) console.log('DRY RUN — no changes will be made');
  console.log();

  // Step 1: List all objects under content/index/
  console.log('Listing objects under content/index/...');
  const keys = r2List('content/index/');

  if (keys.length === 0) {
    console.log('No objects found under content/index/. Nothing to migrate.');
    return;
  }

  console.log(`Found ${keys.length} object(s) to migrate.\n`);

  const migratedIds: string[] = [];
  let errors = 0;

  for (const oldKey of keys) {
    // Extract the ID from the key: content/index/{id}.json → {id}
    const filename = oldKey.split('/').pop();
    if (!filename) {
      console.log(`  SKIP: Could not extract filename from key: ${oldKey}`);
      continue;
    }
    const id = filename.replace(/\.json$/, '');
    const newKey = `indexes/${id}.json`;

    console.log(`  ${oldKey} → ${newKey}`);

    if (dryRun) {
      migratedIds.push(id);
      continue;
    }

    try {
      // Read the document from old location
      const body = r2Get(oldKey);

      // Write to new location
      r2Put(newKey, body);

      // Delete old location
      r2Delete(oldKey);

      migratedIds.push(id);
      console.log(`    OK`);
    } catch (err) {
      errors++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`    ERROR: ${msg}`);
    }
  }

  // Step 2: Delete Vectorize entries for migrated IDs
  // Index documents are structural (table of contents), not semantic content,
  // so they should not have Vectorize embeddings.
  if (migratedIds.length > 0 && !dryRun) {
    console.log(`\nDeleting ${migratedIds.length} Vectorize entries...`);
    try {
      vectorizeDeleteByIds(migratedIds);
      console.log('  OK');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  WARNING: Vectorize deletion failed (may not have entries): ${msg}`);
    }
  }

  console.log(`\n=== Migration Complete ===`);
  console.log(`  Migrated: ${migratedIds.length}`);
  console.log(`  Errors: ${errors}`);
  if (dryRun) console.log('  (dry run — no changes were made)');
}

main().catch((err) => {
  console.error('Migration failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
