import { Rubric } from '../schemas/rubric.schema';

export function generateProjectEvaluationPrompt(
  rubric: Rubric,
  caseStudy: string,
  projectText: string,
): string {
  const criteriaSections = rubric.criteria
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

  return `You are an expert evaluator assessing a student's project report based on a case study brief and scoring rubric.

## Case Study Brief
${caseStudy}

## Evaluation Rubric
${criteriaSections}

## Project Report to Evaluate
${projectText}

## Instructions
1. Read the case study brief to understand the problem context and requirements
2. Carefully review the project report against each criterion in the rubric
3. Use the provided scoring guide (1-5 scale) to assign scores based on actual evidence in the project
4. Provide specific reasoning that references concrete examples from the project report
5. Consider how well the project addresses the case study requirements
6. Ensure your evaluation is fair, consistent, and evidence-based

## Important Guidelines
- Score based on what is actually present in the project report, not assumptions
- Reference specific sections, methodologies, or findings from the report
- Consider alignment with the case study brief and problem requirements
- Be objective and constructive in your feedback
- Highlight both strengths and areas for improvement
- Use the exact criterion names (snake_case format) as provided in the rubric

Return your evaluation in the specified JSON format.`;
}
