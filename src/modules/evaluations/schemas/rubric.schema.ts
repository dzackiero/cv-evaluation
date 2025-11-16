import { z } from 'zod';

/**
 * Zod schema for scoring guide entry (1-5 scale)
 */
export const ScoringGuideSchema = z.object({
  '1': z.string(),
  '2': z.string(),
  '3': z.string(),
  '4': z.string(),
  '5': z.string(),
});

/**
 * Zod schema for a single rubric criterion
 */
export const RubricCriterionSchema = z.object({
  name: z.string().describe('Criterion name in snake_case format'),
  displayName: z.string().describe('Human-readable criterion name'),
  weight: z.number().min(0).max(100).describe('Weight as percentage'),
  description: z.string().describe('What this criterion evaluates'),
  scoringGuide: ScoringGuideSchema.describe(
    'Scoring descriptions for levels 1-5',
  ),
});

/**
 * Zod schema for complete rubric
 */
export const RubricSchema = z.object({
  criteria: z
    .array(RubricCriterionSchema)
    .min(1)
    .describe('Array of evaluation criteria'),
});

export type RubricCriterion = z.infer<typeof RubricCriterionSchema>;
export type Rubric = z.infer<typeof RubricSchema>;
export type ScoringGuide = z.infer<typeof ScoringGuideSchema>;
