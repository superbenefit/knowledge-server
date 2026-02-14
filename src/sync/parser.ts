import { parse as parseYaml } from 'yaml';
import { ContentTypeSchema, FileSchema, inferContentType } from '../types/content';
import type { ParsedMarkdown } from '../types/sync';

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

/**
 * Parse a markdown file with YAML frontmatter into structured data.
 *
 * Expects the format:
 * ```
 * ---
 * title: Some Title
 * publish: true
 * ---
 * Body content here...
 * ```
 */
export function parseMarkdown(raw: string): ParsedMarkdown {
  const match = raw.match(FRONTMATTER_REGEX);

  if (!match) {
    return {
      frontmatter: {},
      body: raw.trim(),
    };
  }

  const [, yamlBlock, body] = match;
  let frontmatter: Record<string, unknown>;

  let parseError: string | undefined;
  try {
    // Security: Limit YAML size and alias depth to prevent DoS (billion laughs attack)
    if (yamlBlock.length > 10000) {
      throw new Error('YAML frontmatter too large');
    }
    frontmatter = parseYaml(yamlBlock, { maxAliasCount: 10 }) ?? {};
  } catch (err) {
    // Signal the error rather than silently returning empty frontmatter,
    // which would cause shouldSync() → false → deletion of existing R2 document.
    frontmatter = {};
    parseError = err instanceof Error ? err.message : 'Unknown YAML parse error';
  }

  if (typeof frontmatter !== 'object' || frontmatter === null || Array.isArray(frontmatter)) {
    frontmatter = {};
  }

  return {
    frontmatter,
    body: body.trim(),
    ...(parseError ? { parseError } : {}),
  };
}

/**
 * Validate frontmatter against the base FileSchema.
 * Returns the parsed result on success, or null if validation fails.
 */
export function validateFrontmatter(
  frontmatter: Record<string, unknown>,
): Record<string, unknown> | null {
  const result = FileSchema.safeParse(frontmatter);
  if (!result.success) {
    return null;
  }
  return result.data as unknown as Record<string, unknown>;
}

/**
 * Determine whether a file should be synced based on its frontmatter.
 * Only published, non-draft content is synced to R2.
 */
export function shouldSync(frontmatter: Record<string, unknown>): boolean {
  return frontmatter.publish === true && frontmatter.draft !== true;
}

/**
 * Resolve the content type for a file: use frontmatter `type` if present
 * and valid, otherwise infer from the file path.
 */
export function resolveContentType(
  frontmatter: Record<string, unknown>,
  filePath: string,
): ReturnType<typeof inferContentType> {
  if (typeof frontmatter.type === 'string') {
    const parsed = ContentTypeSchema.safeParse(frontmatter.type);
    if (parsed.success) {
      return parsed.data;
    }
  }
  return inferContentType(filePath);
}
