import { z } from 'zod';
import { Rubric } from './rubric.schema';

export function generateEvaluationSchema(rubric: Rubric): z.ZodType {
  const criteriaSchemaShape: Record<string, z.ZodType> = {};

  rubric.criteria.forEach((criterion) => {
    criteriaSchemaShape[criterion.name] = z.object({
      score: z
        .number()
        .int()
        .min(1)
        .max(5)
        .describe(`Score for ${criterion.displayName} (1-5 scale)`),
      reasoning: z
        .string()
        .min(20)
        .describe(`Justification for the ${criterion.displayName} score`),
    });
  });

  return z.object({
    criteria: z
      .object(criteriaSchemaShape)
      .describe('Evaluation scores for each criterion'),
    feedback: z
      .string()
      .min(100)
      .describe('Overall evaluation feedback and summary'),
  });
}

export interface EvaluationResult {
  criteria: Record<
    string,
    {
      score: number;
      reasoning: string;
      weight: number;
      displayName: string;
    }
  >;
  weighted_score: number;
  feedback: string;
}

export interface OverallEvaluationResult {
  cv_match_rate: number;
  cv_feedback: string;
  project_score: number;
  project_feedback: string;
  overall_summary: string;
}
