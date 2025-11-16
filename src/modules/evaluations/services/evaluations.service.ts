import { Injectable, Logger } from '@nestjs/common';
import { EvaluationDocumentService } from './evaluation-document.service';
import { SystemDocsService } from './system-docs.service';
import { generateText, generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import {
  EvaluationResult,
  OverallEvaluationResult,
  generateEvaluationSchema,
} from '../schemas/evaluation.schema';
import { generateCvEvaluationPrompt } from '../prompts/cv-evaluation.prompt';
import { generateProjectEvaluationPrompt } from '../prompts/project-evaluation.prompt';
import { generateOverallSummaryPrompt } from '../prompts/overall-evaluation.prompt';

@Injectable()
export class EvaluationsService {
  private logger = new Logger(EvaluationsService.name);

  constructor(
    private readonly documentService: EvaluationDocumentService,
    private readonly systemDocsService: SystemDocsService,
  ) {}

  async evaluateCv(
    userId: string,
    fileId: string,
    jobTitle: string,
  ): Promise<EvaluationResult> {
    this.logger.log(`Starting CV evaluation for job: ${jobTitle}`);
    const cvContent = await this.documentService.loadFileContent(
      fileId,
      userId,
    );

    this.logger.debug('Loading CV rubric from RAG');
    const rubric = await this.systemDocsService.getCvRubric();
    this.logger.log(`Rubric loaded with ${rubric.criteria.length} criteria`);

    const jobDescription =
      await this.systemDocsService.getJobDescription(jobTitle);

    this.logger.debug('Generating evaluation schema from rubric');
    const schema = generateEvaluationSchema(rubric);

    this.logger.debug('Building evaluation prompt');
    const prompt = generateCvEvaluationPrompt({
      jobTitle,
      jobDescription,
      rubric,
      cvContent,
    });

    this.logger.debug('Calling LLM for evaluation');
    const result = await generateObject({
      model: openai('gpt-4o-mini'),
      temperature: 0.1,
      schema,
      prompt,
    });

    const evaluationResult = result.object as {
      criteria: Record<string, { score: number; reasoning: string }>;
      feedback: string;
    };

    this.logger.debug('LLM evaluation complete, processing results');
    let weightedSum = 0;
    let totalWeight = 0;
    const enrichedCriteria: EvaluationResult['criteria'] = {};

    rubric.criteria.forEach((criterion) => {
      const criterionResult = evaluationResult.criteria[criterion.name];
      if (criterionResult) {
        enrichedCriteria[criterion.name] = {
          score: criterionResult.score,
          reasoning: criterionResult.reasoning,
          weight: criterion.weight,
          displayName: criterion.displayName,
        };

        const normalizedScore = ((criterionResult.score - 1) / 4) * 100;
        weightedSum += normalizedScore * (criterion.weight / 100);
        totalWeight += criterion.weight;
      }
    });

    const weighted_score =
      totalWeight > 0 ? Math.round(weightedSum * 100) / 100 : 0;

    this.logger.log(
      `CV evaluation complete - weighted score: ${weighted_score}%`,
    );

    return {
      weighted_score,
      criteria: enrichedCriteria,
      feedback: evaluationResult.feedback,
    };
  }

  async evaluateProject(
    userId: string,
    fileId: string,
    jobTitle: string,
  ): Promise<EvaluationResult> {
    this.logger.log('Starting project evaluation');

    const projectContent = await this.documentService.loadFileContent(
      fileId,
      userId,
    );
    this.logger.debug('Project content loaded');

    const rubric = await this.systemDocsService.getProjectRubric();
    this.logger.log(
      `Project rubric loaded with ${rubric.criteria.length} criteria`,
    );

    const caseStudy = await this.systemDocsService.getCaseStudy(jobTitle);
    this.logger.debug('Case study brief loaded');

    this.logger.debug('Generating evaluation schema from rubric');
    const schema = generateEvaluationSchema(rubric);

    this.logger.debug('Building evaluation prompt');
    const prompt = generateProjectEvaluationPrompt(
      rubric,
      caseStudy,
      projectContent,
    );

    this.logger.debug('Calling LLM for evaluation');
    const result = await generateObject({
      model: openai('gpt-4o-mini'),
      temperature: 0.1,
      schema,
      prompt,
    });

    const evaluationResult = result.object as {
      criteria: Record<string, { score: number; reasoning: string }>;
      feedback: string;
    };

    this.logger.debug('LLM evaluation complete, processing results');

    // Calculate weighted score
    let weightedSum = 0;
    let totalWeight = 0;
    const enrichedCriteria: EvaluationResult['criteria'] = {};

    rubric.criteria.forEach((criterion) => {
      const criterionResult = evaluationResult.criteria[criterion.name];
      if (criterionResult) {
        enrichedCriteria[criterion.name] = {
          score: criterionResult.score,
          reasoning: criterionResult.reasoning,
          weight: criterion.weight,
          displayName: criterion.displayName,
        };

        const normalizedScore = ((criterionResult.score - 1) / 4) * 100;
        weightedSum += normalizedScore * (criterion.weight / 100);
        totalWeight += criterion.weight;
      }
    });

    const weighted_score =
      totalWeight > 0 ? Math.round(weightedSum * 100) / 100 : 0;

    this.logger.log(
      `Project evaluation complete - weighted score: ${weighted_score}%`,
    );

    return {
      weighted_score,
      criteria: enrichedCriteria,
      feedback: evaluationResult.feedback,
    };
  }

  async evaluateCandidate(
    userId: string,
    cvFileId: string,
    projectFileId: string,
    jobTitle: string,
  ): Promise<OverallEvaluationResult> {
    this.logger.log(
      `Starting complete candidate evaluation for job: ${jobTitle}`,
    );

    // Run CV and project evaluations in parallel
    const [cvResult, projectResult] = await Promise.all([
      this.evaluateCv(userId, cvFileId, jobTitle),
      this.evaluateProject(userId, projectFileId, jobTitle),
    ]);

    const cv_match_rate =
      Math.round((cvResult.weighted_score / 100) * 100) / 100;
    const project_score =
      Math.round(((projectResult.weighted_score / 100) * 4 + 1) * 10) / 10;

    this.logger.debug('Generating overall candidate summary');
    const prompt = generateOverallSummaryPrompt(
      cv_match_rate,
      cvResult.feedback,
      project_score,
      projectResult.feedback,
    );

    const summaryResult = await generateText({
      model: openai('gpt-4o-mini'),
      temperature: 0.2,
      prompt,
    });

    const overall_summary = summaryResult.text;

    this.logger.log(
      `Complete evaluation finished - CV: ${cv_match_rate}, Project: ${project_score}`,
    );

    return {
      cv_match_rate,
      cv_feedback: cvResult.feedback,
      project_score,
      project_feedback: projectResult.feedback,
      overall_summary,
    };
  }
}
