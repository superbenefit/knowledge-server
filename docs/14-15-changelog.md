# Knowledge Server Spec Changelog: v0.14 → v0.15

**Date:** February 7, 2026  
**Aligned with:** ontology.md (Feb 7, 2026 revision)

---

## Summary

This update aligns the knowledge server spec with the revised knowledge base filesystem ontology. The ontology introduces a two-space model: **docs/** for creative outputs organized by authoring group, and **data/** for structured records organized by content type. The `question` type is promoted to a standalone type (no longer a resource sub-type), following Simon Grant's knowledge commons framework.

---

## 1. Header — Ontology Alignment Added

**v0.14:**
```
Version: 0.14
Date: February 7, 2026
Porch Spec Alignment: v0.18
```

**v0.15:**
```
Version: 0.15
Date: February 7, 2026
Porch Spec Alignment: v0.18
Ontology Alignment: ontology.md (Feb 7, 2026)
```

Tracks which ontology revision this spec is aligned with.

## 2. §1.2 Prerequisites — Directory List Updated

**v0.14:**
```
1. Directory restructuring (artifacts/, data/, links/, tags/, notes/, drafts/)
2. ...
4. Addition of required frontmatter fields (group, release, etc.)
```

**v0.15:**
```
1. Directory restructuring (docs/, data/, drafts/)
2. ...
4. Addition of required frontmatter fields (type, group, etc.)
```

Reflects the simplified two-space model. `type` replaces `release` in the example since docs/ files now require an explicit `type` frontmatter field.

## 3. §3.1 — Complete Section Rewrite (Directory Structure → Filesystem)

Section renamed from "Knowledge Base Directory Structure" to "Knowledge Base Filesystem".

**v0.14:** Listed 5 top-level directories (`artifacts/`, `data/`, `links/`, `tags/`, `notes/`, `drafts/`).

**v0.15:** Two-space model with 3 top-level directories:

| v0.14 Directory | v0.15 Location | Notes |
|-----------------|----------------|-------|
| `artifacts/patterns/` | `data/resources/patterns/` | Nested under parent type |
| `artifacts/practices/` | `data/resources/practices/` | Nested under parent type |
| `artifacts/primitives/` | `data/resources/primitives/` | Nested under parent type |
| `artifacts/protocols/` | `data/resources/protocols/` | Nested under parent type |
| `artifacts/playbooks/` | `data/resources/playbooks/` | Nested under parent type |
| `artifacts/questions/` | `data/questions/` | Standalone (not under resources/) |
| `artifacts/studies/` | `data/stories/studies/` | Nested under parent type |
| `artifacts/articles/` | `data/stories/articles/` | Nested under parent type |
| `data/people/` | `data/people/` | Unchanged |
| `data/groups/` | `data/groups/` | Unchanged |
| `data/projects/` | `data/projects/` | Unchanged |
| `data/places/` | `data/places/` | Unchanged |
| `data/gatherings/` | `data/gatherings/` | Unchanged |
| `links/` | `data/links/` | Moved into data/ |
| `tags/` | `data/concepts/` | Renamed and moved into data/ |
| `notes/` | `docs/` | Renamed; organized by group |
| `drafts/` | `drafts/` | Unchanged (gitignored) |

Added introductory text explaining the two-space model and the Official Release mechanism (index.base files in docs/ subfolders).

## 4. §3.2 Type Hierarchy — Question Promoted to Standalone

**v0.14:** `question` listed under `resource` parent.

**v0.15:** `question` is a direct child of `file`, positioned between `resource` and `story` in the tree.

Added note: "Per Simon Grant's knowledge commons ontology, questions 'sit at the growing edge of knowledge' — they represent generative unknowns, not commoned artifacts."

## 5. §3.3 Content Type Enum — Regrouped

**v0.14:**
```typescript
// Resource types
'resource', 'pattern', 'practice', 'primitive', 'protocol', 'playbook', 'question',
```

**v0.15:**
```typescript
// Resource types
'resource', 'pattern', 'practice', 'primitive', 'protocol', 'playbook',
// Question (standalone)
'question',
```

No values added or removed — only regrouped with updated comment.

## 6. §3.4 Parent Type Groupings — Question Removed from RESOURCE_TYPES

**v0.14:**
```typescript
export const RESOURCE_TYPES: ContentType[] = [
  'pattern', 'practice', 'primitive', 'protocol', 'playbook', 'question'
];
```

**v0.15:**
```typescript
export const RESOURCE_TYPES: ContentType[] = [
  'pattern', 'practice', 'primitive', 'protocol', 'playbook'
];
```

`question` is no longer grouped with resources. It has no parent type grouping constant (it stands alone under `file`).

## 7. §3.5 Path → Type Mapping — Complete Replacement

This is the primary code change that affects sync, retrieval, and the R2 key structure.

**v0.14:**
```typescript
export const PATH_TYPE_MAP: Record<string, ContentType> = {
  'artifacts/patterns': 'pattern',
  'artifacts/practices': 'practice',
  'artifacts/primitives': 'primitive',
  'artifacts/protocols': 'protocol',
  'artifacts/playbooks': 'playbook',
  'artifacts/questions': 'question',
  'artifacts/studies': 'study',
  'artifacts/articles': 'article',
  'data/people': 'person',
  'data/groups': 'group',
  'data/projects': 'project',
  'data/places': 'place',
  'data/gatherings': 'gathering',
  'links': 'link',
  'tags': 'tag',
  'notes': 'file',
  'drafts': 'file',
};
```

**v0.15:**
```typescript
export const PATH_TYPE_MAP: Record<string, ContentType> = {
  // Data — type-sorted
  'data/concepts':              'tag',
  'data/links':                 'link',
  'data/resources/patterns':    'pattern',
  'data/resources/practices':   'practice',
  'data/resources/primitives':  'primitive',
  'data/resources/protocols':   'protocol',
  'data/resources/playbooks':   'playbook',
  'data/stories/studies':       'study',
  'data/stories/articles':      'article',
  'data/questions':             'question',
  'data/people':                'person',
  'data/groups':                'group',
  'data/projects':              'project',
  'data/places':                'place',
  'data/gatherings':            'gathering',
  // Docs — type from frontmatter, not path
  'docs':                       'file',
};
```

Added note: "Files in `docs/` require a `type` field in frontmatter. Files in `data/` have type inferred from path. The `drafts/` directory is gitignored and not synced."

## 8. §3.6 Schemas — QuestionSchema Base Changed

**v0.14:**
```typescript
export const QuestionSchema = ResourceSchema.extend({
```

**v0.15:**
```typescript
// Question type (standalone — not a resource)
export const QuestionSchema = FileSchema.extend({
```

`QuestionSchema` now extends `FileSchema` instead of `ResourceSchema`. This means it no longer inherits the `release`, `hasPart`, and `isPartOf` fields from `ResourceSchema`. The `status`, `related`, and `proposedBy` fields are unchanged.

## 9. Appendix E: Version History — Entry Added

Added v0.15 entry documenting all changes.

---

## Changes NOT Made

These items were considered but intentionally left unchanged:

1. **Storage architecture (§4)** — R2 key structure (`content/{contentType}/{id}.json`) is unchanged. The R2 key uses `contentType`, not the filesystem path, so the directory restructure does not affect stored data.
2. **Vectorize metadata indexes (§4.3)** — No changes. Same 6 indexed fields.
3. **Sync layer (§5)** — `inferContentType()` is updated via PATH_TYPE_MAP, but the sync workflow logic is unchanged.
4. **Retrieval system (§6)** — No changes.
5. **MCP tools (§7.5)** — No changes to tool definitions or schemas.
6. **REST API (§8)** — No changes.
7. **Error handling (§10)** — No changes.
8. **Infrastructure (§11)** — No changes to resource names or setup commands.
9. **Content Discriminated Union (§3.7)** — No changes. All type literals remain the same.
10. **Worker configuration (Appendix A)** — No changes.

---

## Migration Impact

When the knowledge base repository implements this filesystem restructure:

1. **Existing R2 data is unaffected** — documents are keyed by `content/{contentType}/{id}.json`, not by source path. The `contentType` values haven't changed.
2. **Vectorize index is unaffected** — metadata filters use `contentType`, not filesystem paths.
3. **Sync workflow needs the updated PATH_TYPE_MAP** — so that new pushes from the restructured repo resolve types correctly.
4. **One-time re-sync recommended** — after the kb restructure lands, trigger a full sync to update `path` fields in R2Document records (the `path` field stores the GitHub source path, which will have changed).