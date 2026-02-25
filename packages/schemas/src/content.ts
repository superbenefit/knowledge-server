import { z } from 'zod';

// Content type enum — all 20 types from ontology (spec section 3.3)
export const ContentTypeSchema = z
  .enum([
    // File type (root)
    'file',
    // Reference types
    'reference', 'index', 'link', 'tag',
    // Resource types
    'resource', 'pattern', 'practice', 'primitive', 'protocol', 'playbook', 'question',
    // Story types
    'story', 'study', 'article', 'guide',
    // Data types
    'data', 'person', 'group', 'project', 'place', 'gathering',
  ]);

export type ContentType = z.infer<typeof ContentTypeSchema>;

// Parent type groupings (spec section 3.4)
export const RESOURCE_TYPES: ContentType[] = [
  'pattern', 'practice', 'primitive', 'protocol', 'playbook',
];
export const STORY_TYPES: ContentType[] = ['study', 'article', 'guide'];
export const REFERENCE_TYPES: ContentType[] = ['index', 'link', 'tag'];
export const DATA_TYPES: ContentType[] = [
  'person', 'group', 'project', 'place', 'gathering',
];

// Path prefix → content type mapping (spec section 3.5)
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
  'data/stories/guides':        'guide',
  'data/questions':             'question',
  'data/people':                'person',
  'data/groups':                'group',
  'data/projects':              'project',
  'data/places':                'place',
  'data/gatherings':            'gathering',
  // Docs — type from frontmatter, not path
  'docs':                       'file',
};

export function inferContentType(path: string): ContentType {
  for (const [prefix, type] of Object.entries(PATH_TYPE_MAP)) {
    if (path.startsWith(prefix)) return type;
  }
  return 'file';
}

// ---------------------------------------------------------------------------
// Base schema — FileSchema (spec section 3.6)
// ---------------------------------------------------------------------------

export const FileSchema = z
  .object({
    type: ContentTypeSchema.optional(),
    title: z.string().min(1),
    description: z.string().optional(),
    date: z.coerce.date(),
    publish: z.boolean().default(false),
    draft: z.boolean().default(false),
    permalink: z.string().optional(),
    author: z.array(z.string()).optional(),
    group: z.string().optional(),
  });

export type FileFrontmatter = z.infer<typeof FileSchema>;

// ---------------------------------------------------------------------------
// Parent type schemas (spec section 3.6)
// ---------------------------------------------------------------------------

export const ReferenceSchema = FileSchema;

export const ResourceSchema = FileSchema.extend({
  release: z.string().optional(),
  hasPart: z.array(z.string()).optional(),
  isPartOf: z.array(z.string()).optional(),
});

export type ResourceFrontmatter = z.infer<typeof ResourceSchema>;

export const StorySchema = FileSchema.extend({
  release: z.string().optional(),
});

export type StoryFrontmatter = z.infer<typeof StorySchema>;

export const DataSchema = FileSchema;

// ---------------------------------------------------------------------------
// Concrete type schemas — Reference types
// ---------------------------------------------------------------------------

export const LinkSchema = ReferenceSchema.extend({
  url: z.string().url(),
});

export type LinkFrontmatter = z.infer<typeof LinkSchema>;

export const TagSchema = ReferenceSchema.extend({
  aliases: z.array(z.string()).optional(),
  relatedTerms: z.array(z.string()).optional(),
  category: z.string().optional(),
});

export type TagFrontmatter = z.infer<typeof TagSchema>;

// ---------------------------------------------------------------------------
// Concrete type schemas — Resource types
// ---------------------------------------------------------------------------

export const PatternSchema = ResourceSchema.extend({
  context: z.string().optional(),
  problem: z.string().optional(),
  solution: z.string().optional(),
  relatedPatterns: z.array(z.string()).optional(),
});

export type PatternFrontmatter = z.infer<typeof PatternSchema>;

export const PracticeSchema = ResourceSchema.extend({
  patterns: z.array(z.string()).optional(),
  practitioners: z.array(z.string()).optional(),
});

export type PracticeFrontmatter = z.infer<typeof PracticeSchema>;

export const PrimitiveSchema = ResourceSchema.extend({
  category: z.string().optional(),
});

export type PrimitiveFrontmatter = z.infer<typeof PrimitiveSchema>;

export const ProtocolSchema = ResourceSchema.extend({
  steps: z.array(z.string()).optional(),
});

export type ProtocolFrontmatter = z.infer<typeof ProtocolSchema>;

export const PlaybookSchema = ResourceSchema;

// Question type (standalone — not a resource)
export const QuestionSchema = FileSchema.extend({
  status: z.enum(['open', 'exploring', 'resolved']).optional(),
  related: z.array(z.string()).optional(),
  proposedBy: z.array(z.string()).optional(),
});

export type QuestionFrontmatter = z.infer<typeof QuestionSchema>;

// ---------------------------------------------------------------------------
// Concrete type schemas — Story types
// ---------------------------------------------------------------------------

export const StudySchema = StorySchema;

export const ArticleSchema = StorySchema.extend({
  url: z.string().url().optional(),
  curator: z.string().optional(),
  harvester: z.string().optional(),
});

export type ArticleFrontmatter = z.infer<typeof ArticleSchema>;

export const GuideSchema = StorySchema;

// ---------------------------------------------------------------------------
// Concrete type schemas — Data types
// ---------------------------------------------------------------------------

export const PersonSchema = DataSchema.extend({
  aliases: z.array(z.string()).optional(),
  roles: z.array(z.string()).optional(),
  groups: z.array(z.string()).optional(),
  homepage: z.string().url().optional(),
  email: z.string().email().optional(),
  image: z.string().optional(),
});

export type PersonFrontmatter = z.infer<typeof PersonSchema>;

export const GroupSchema = DataSchema.extend({
  slug: z.string().optional(),
  members: z.array(z.string()).optional(),
  parent: z.string().optional(),
  homepage: z.string().url().optional(),
});

export type GroupFrontmatter = z.infer<typeof GroupSchema>;

export const ProjectSchema = DataSchema.extend({
  slug: z.string().optional(),
  status: z.enum(['active', 'completed', 'paused', 'archived']).optional(),
  lead: z.array(z.string()).optional(),
  contributors: z.array(z.string()).optional(),
  group: z.string().optional(),
  repository: z.string().optional(),
  homepage: z.string().url().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export type ProjectFrontmatter = z.infer<typeof ProjectSchema>;

export const PlaceSchema = DataSchema.extend({
  geo: z.string().optional(),
  containedIn: z.string().optional(),
  region: z.string().optional(),
});

export type PlaceFrontmatter = z.infer<typeof PlaceSchema>;

export const GatheringSchema = DataSchema.extend({
  location: z.string().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  organizers: z.array(z.string()).optional(),
  attendees: z.array(z.string()).optional(),
  outcomes: z.array(z.string()).optional(),
});

export type GatheringFrontmatter = z.infer<typeof GatheringSchema>;

// ---------------------------------------------------------------------------
// Discriminated union for API responses (spec section 3.6)
// ---------------------------------------------------------------------------

export const ContentSchema = z.discriminatedUnion('type', [
  FileSchema.extend({ type: z.literal('file') }),
  LinkSchema.extend({ type: z.literal('link') }),
  TagSchema.extend({ type: z.literal('tag') }),
  PatternSchema.extend({ type: z.literal('pattern') }),
  PracticeSchema.extend({ type: z.literal('practice') }),
  PrimitiveSchema.extend({ type: z.literal('primitive') }),
  ProtocolSchema.extend({ type: z.literal('protocol') }),
  PlaybookSchema.extend({ type: z.literal('playbook') }),
  QuestionSchema.extend({ type: z.literal('question') }),
  StudySchema.extend({ type: z.literal('study') }),
  ArticleSchema.extend({ type: z.literal('article') }),
  GuideSchema.extend({ type: z.literal('guide') }),
  PersonSchema.extend({ type: z.literal('person') }),
  GroupSchema.extend({ type: z.literal('group') }),
  ProjectSchema.extend({ type: z.literal('project') }),
  PlaceSchema.extend({ type: z.literal('place') }),
  GatheringSchema.extend({ type: z.literal('gathering') }),
]);

export type Content = z.infer<typeof ContentSchema>;
