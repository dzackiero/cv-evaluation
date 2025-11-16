import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EvaluationDocumentsService } from './evaluation-documents.service';
import { SystemDocumentsService } from './system-documents.service';
import { openai } from '@ai-sdk/openai';
import {
  generateObjectWithRetry,
  generateTextWithRetry,
} from 'src/common/utils/llm.util';
import {
  EvalResult,
  generateEvaluationSchema,
} from '../schemas/evaluation.schema';
import { generateCvEvaluationPrompt } from '../prompts/cv-evaluation.prompt';
import { generateProjectEvaluationPrompt } from '../prompts/project-evaluation.prompt';
import { generateOverallSummaryPrompt } from '../prompts/overall-evaluation.prompt';
import { EvaluateCandidateDto } from '../dto/request/evaluate-candidate.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { FileType, JobStatus } from 'generated/prisma';
import { FlowProducer } from 'bullmq';
import { InjectFlowProducer } from '@nestjs/bullmq';

@Injectable()
export class EvaluationsService {
  private logger = new Logger(EvaluationsService.name);
  private readonly SUMMARY_TEMPERATURE = 0.2;
  private readonly EVAL_TEMPERATURE = 0.1;
  private readonly JOB_OPTIONS = {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  };

  constructor(
    @InjectFlowProducer('evaluation-flow')
    private readonly flowProducer: FlowProducer,
    private readonly prismaService: PrismaService,
    private readonly documentService: EvaluationDocumentsService,
    private readonly systemDocumentsService: SystemDocumentsService,
  ) {}

  async initializeJob(userId: string, request: EvaluateCandidateDto) {
    this.logger.log('Initializing evaluation job');
    const job = await this.prismaService.job.create({
      data: {
        userId,
        cvFileId: request.cvFileId,
        reportFileId: request.reportFileId,
        jobTitle: request.jobTitle,
        status: JobStatus.QUEUED,
      },
    });

    await this.prismaService.evaluationResult.create({
      data: {
        jobId: job.id,
        currentStage: 'queued',
      },
    });

    await this.flowProducer.add({
      name: 'overall-scoring',
      queueName: 'overall-scoring',
      data: {
        jobId: job.id,
      },
      children: [
        {
          name: 'cv-evaluation',
          queueName: 'cv-evaluation',
          opts: this.JOB_OPTIONS,
          data: {
            userId,
            jobId: job.id,
            cvFileId: request.cvFileId,
            jobTitle: request.jobTitle,
          },
        },
        {
          name: 'project-evaluation',
          queueName: 'project-evaluation',
          opts: this.JOB_OPTIONS,
          data: {
            jobId: job.id,
            userId,
            projectFileId: request.reportFileId,
            jobTitle: request.jobTitle,
          },
        },
      ],
    });

    return job;
  }

  async getJobStatus(jobId: string) {
    const job = await this.prismaService.job.findUnique({
      where: { id: jobId },
      include: { result: true },
    });

    if (!job) {
      throw new NotFoundException(`Job with ID ${jobId} not found`);
    }

    return {
      id: job.id,
      status: job.status,
      result:
        job.status === JobStatus.COMPLETED &&
        job.result?.cvMatchRate &&
        job.result?.projectScore
          ? {
              cv_match_rate: job.result.cvMatchRate,
              cv_feedback: job.result.cvFeedback || '',
              project_score: job.result.projectScore,
              project_feedback: job.result.projectFeedback || '',
              overall_summary: job.result.overallSummary || '',
            }
          : undefined,
      error: job.result?.error ?? undefined,
    };
  }

  async updateFailedJob(jobId: string) {
    this.logger.log(`Updating job ${jobId} status to ${JobStatus.FAILED}`);
    await this.prismaService.job.update({
      where: { id: jobId },
      data: { status: JobStatus.FAILED },
    });

    await this.prismaService.evaluationResult.update({
      where: { jobId },
      data: {
        error: 'Evaluation process failed',
        currentStage: 'failed',
      },
    });
  }

  async evaluate(
    type: FileType,
    userId: string,
    fileId: string,
    jobTitle: string,
    jobId?: string,
  ) {
    const content = await this.documentService.loadFileContent(
      fileId,
      userId,
      type,
    );

    if (type === FileType.CV) {
      return this.evaluateCv(content, jobTitle, jobId);
    } else {
      return this.evaluateProject(content, jobTitle, jobId);
    }
  }

  async evaluateCv(
    cvContent: string,
    jobTitle: string,
    jobId?: string,
  ): Promise<EvalResult> {
    this.logger.log(`Starting CV evaluation for job: ${jobTitle}`);

    if (jobId) {
      await this.prismaService.evaluationResult.update({
        where: { jobId },
        data: { currentStage: 'cv_processing' },
      });
    }

    const rubric = await this.systemDocumentsService.getCvRubric();
    this.logger.debug(`Rubric loaded with ${rubric.criteria.length} criteria`);

    const jobDescription =
      await this.systemDocumentsService.getJobDescription(jobTitle);

    this.logger.debug('Generating evaluation schema from rubric');
    const schema = generateEvaluationSchema(rubric);

    this.logger.debug('Building evaluation prompt');
    const prompt = generateCvEvaluationPrompt({
      jobTitle,
      jobDescription,
      rubric,
      cvContent,
    });

    this.logger.debug('Calling LLM for evaluation with retry logic');
    const evaluationResult = (await generateObjectWithRetry({
      model: openai('gpt-4o-mini'),
      temperature: this.EVAL_TEMPERATURE,
      schema,
      prompt,
    })) as {
      criteria: Record<string, { score: number; reasoning: string }>;
      feedback: string;
    };

    this.logger.debug('LLM evaluation complete, processing results');
    let weightedSum = 0;
    let totalWeight = 0;
    const enrichedCriteria: EvalResult['criteria'] = {};

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

    const cv_match_rate = Math.round((weighted_score / 100) * 100) / 100;

    if (jobId) {
      await this.prismaService.evaluationResult.update({
        where: { jobId },
        data: {
          cvMatchRate: cv_match_rate,
          cvFeedback: evaluationResult.feedback,
          cvCriteria: enrichedCriteria,
          currentStage: 'cv_completed',
        },
      });
    }

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
    projectContent: string,
    jobTitle: string,
    jobId?: string,
  ): Promise<EvalResult> {
    this.logger.log('Starting project evaluation');

    if (jobId) {
      await this.prismaService.evaluationResult.update({
        where: { jobId },
        data: { currentStage: 'project_processing' },
      });
    }

    const rubric = await this.systemDocumentsService.getProjectRubric();
    this.logger.debug(
      `Project rubric loaded with ${rubric.criteria.length} criteria`,
    );

    const caseStudy = await this.systemDocumentsService.getCaseStudy(jobTitle);
    this.logger.debug('Case study brief loaded');

    this.logger.debug('Generating evaluation schema from rubric');
    const schema = generateEvaluationSchema(rubric);

    this.logger.debug('Building evaluation prompt');
    const prompt = generateProjectEvaluationPrompt(
      rubric,
      caseStudy,
      projectContent,
    );

    this.logger.debug('Calling LLM for evaluation with retry logic');
    const evaluationResult = (await generateObjectWithRetry({
      model: openai('gpt-4o-mini'),
      temperature: this.EVAL_TEMPERATURE,
      schema,
      prompt,
    })) as {
      criteria: Record<string, { score: number; reasoning: string }>;
      feedback: string;
    };

    this.logger.debug('LLM evaluation complete, processing results');

    let weightedSum = 0;
    let totalWeight = 0;
    const enrichedCriteria: EvalResult['criteria'] = {};
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

    const project_score =
      Math.round(((weighted_score / 100) * 4 + 1) * 10) / 10;

    if (jobId) {
      await this.prismaService.evaluationResult.update({
        where: { jobId },
        data: {
          projectScore: project_score,
          projectFeedback: evaluationResult.feedback,
          projectCriteria: enrichedCriteria,
          currentStage: 'project_completed',
        },
      });
    }

    this.logger.log(
      `Project evaluation complete - weighted score: ${weighted_score}%`,
    );

    return {
      weighted_score,
      criteria: enrichedCriteria,
      feedback: evaluationResult.feedback,
    };
  }

  async evaluateCandidate(jobId: string): Promise<void> {
    this.logger.log(`Starting overall scoring for job: ${jobId}`);

    await this.prismaService.evaluationResult.update({
      where: { jobId },
      data: { currentStage: 'overall_processing' },
    });

    const result = await this.prismaService.evaluationResult.findUnique({
      where: { jobId },
    });

    if (!result || !result.cvMatchRate || !result.projectScore) {
      throw new Error('CV or Project evaluation not completed');
    }

    this.logger.debug('Generating overall candidate summary with retry logic');
    const prompt = generateOverallSummaryPrompt(
      result.cvMatchRate,
      result.cvFeedback || 'no feedback provided',
      result.projectScore,
      result.projectFeedback || 'no feedback provided',
    );

    const overall_summary = await generateTextWithRetry({
      model: openai('gpt-4o-mini'),
      temperature: this.SUMMARY_TEMPERATURE,
      prompt,
    });

    await this.prismaService.$transaction([
      this.prismaService.evaluationResult.update({
        where: { jobId },
        data: {
          overallSummary: overall_summary,
          currentStage: 'completed',
          completedAt: new Date(),
        },
      }),
      this.prismaService.job.update({
        where: { id: jobId },
        data: { status: JobStatus.COMPLETED },
      }),
    ]);

    this.logger.log(
      `Complete evaluation finished - CV: ${result.cvMatchRate}, Project: ${result.projectScore}`,
    );
  }
}
