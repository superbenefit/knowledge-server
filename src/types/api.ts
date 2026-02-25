import { z } from 'zod';
import { VectorizeMetadataSchema } from './storage';

// Shared API schemas — canonical definitions in @superbenefit/knowledge-schemas
export {
  SearchFiltersSchema,
  ListParamsSchema,
  SearchParamsSchema,
  SearchResultSchema,
  ErrorResponseSchema,
  EntryResponseSchema,
  EntryListResponseSchema,
  SearchResponseSchema,
} from '@superbenefit/knowledge-schemas';
export type {
  SearchFilters,
  ListParams,
  SearchParams,
  SearchResult,
  ErrorResponse,
} from '@superbenefit/knowledge-schemas';

// Reranked search result (spec section 6.3)
// Kept locally — depends on VectorizeMetadataSchema which is internal
export const RerankResultSchema = z
  .object({
    id: z.string(),
    score: z.number(),
    rerankScore: z.number(),
    metadata: VectorizeMetadataSchema,
  });

export type RerankResult = z.infer<typeof RerankResultSchema>;
