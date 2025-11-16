export function generateOverallSummaryPrompt(
  cvMatchRate: number,
  cvFeedback: string,
  projectScore: number,
  projectFeedback: string,
): string {
  return `Based on the following evaluation results, provide a concise 3-5 sentence overall summary of the candidate.

CV Evaluation (Match Rate: ${cvMatchRate}):
${cvFeedback}

Project Evaluation (Score: ${projectScore}/5):
${projectFeedback}

Provide a balanced summary that:
1. Highlights the candidate's key strengths
2. Identifies any significant gaps or areas for improvement
3. Offers a clear recommendation about their fit for the role

Keep it professional, objective, and actionable.`;
}
