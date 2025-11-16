import { z } from 'zod';

export const OverallSummarySchema = z.object({
  summary: z
    .string()
    .min(100)
    .max(500)
    .describe('3-5 sentence overall candidate summary'),
});

export interface OverallSummaryResult {
  summary: string;
}
