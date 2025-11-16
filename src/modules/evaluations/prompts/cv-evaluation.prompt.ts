import { Rubric } from '../schemas/rubric.schema';

export function generateCvEvaluationPrompt(params: {
  jobTitle: string;
  jobDescription: string;
  rubric: Rubric;
  cvContent: string;
}): string {
  const criteriaSection = params.rubric.criteria
    .map((criterion, index) => {
      const scoringGuide = Object.entries(criterion.scoringGuide)
        .map(([score, desc]) => `   ${score} = ${desc}`)
        .join('\n');

      return `${index + 1}. **${criterion.displayName}** (Weight: ${criterion.weight}%)
  ${criterion.description}

  Score 1-5 where:
${scoringGuide}`;
    })
    .join('\n\n');

  return `You are an expert recruiter evaluating a candidate's CV against specific rubric criteria.

JOB TITLE: ${params.jobTitle}

JOB DESCRIPTION:
${params.jobDescription}

EVALUATION CRITERIA:
${criteriaSection}

CANDIDATE'S CV:
${params.cvContent}

INSTRUCTIONS:
- Evaluate the CV against EACH criterion listed above
- Assign a score from 1-5 for each criterion based on the exact scoring guide provided
- Provide clear reasoning for each score (minimum 20 characters)
- Write comprehensive overall feedback (minimum 100 characters)
- Use the exact criterion names (snake_case format) as provided in the rubric

IMPORTANT:
- Be objective and thorough in your evaluation
- Base your scores strictly on the scoring guide descriptions
- Justify each score with specific evidence from the CV
- Consider the weight of each criterion in your overall assessment

Return your evaluation in the specified JSON format.`;
}
