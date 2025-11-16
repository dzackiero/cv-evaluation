import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EvaluationsService } from '../services/evaluations.service';
import { FileType } from 'generated/prisma/wasm';

export interface CvEvaluationJobData {
  jobId: string;
  userId: string;
  cvFileId: string;
  jobTitle: string;
}

export interface ProjectEvaluationJobData {
  jobId: string;
  userId: string;
  projectFileId: string;
  jobTitle: string;
}

@Processor('cv-evaluation', {
  concurrency: 5,
})
export class CvEvaluationProcessor extends WorkerHost {
  private readonly logger = new Logger(CvEvaluationProcessor.name);

  constructor(private readonly evaluationsService: EvaluationsService) {
    super();
  }

  async process(job: Job<CvEvaluationJobData>): Promise<void> {
    const { jobId, userId, cvFileId, jobTitle } = job.data;
    this.logger.log(`Processing CV evaluation for job ${jobId}`);

    try {
      await this.evaluationsService.evaluate(
        FileType.CV,
        userId,
        cvFileId,
        jobTitle,
        jobId,
      );
      this.logger.log(`CV evaluation completed for job ${jobId}`);
    } catch (error) {
      this.logger.error(`CV evaluation failed for job ${jobId}:`, error);
      throw error;
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<CvEvaluationJobData>, error: Error) {
    this.logger.error(
      `Job ${job.id} failed after ${job.attemptsMade} attempts:`,
      error,
    );
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<CvEvaluationJobData>) {
    this.logger.log(`Job ${job.id} completed successfully`);
  }
}

@Processor('project-evaluation', {
  concurrency: 5,
})
export class ProjectEvaluationProcessor extends WorkerHost {
  private readonly logger = new Logger(ProjectEvaluationProcessor.name);

  constructor(private readonly evaluationsService: EvaluationsService) {
    super();
  }

  async process(job: Job<ProjectEvaluationJobData>): Promise<void> {
    const { jobId, userId, projectFileId, jobTitle } = job.data;
    this.logger.log(`Processing project evaluation for job ${jobId}`);

    try {
      await this.evaluationsService.evaluate(
        FileType.PROJECT_REPORT,
        userId,
        projectFileId,
        jobTitle,
        jobId,
      );
      this.logger.log(`Project evaluation completed for job ${jobId}`);
    } catch (error) {
      this.logger.error(`Project evaluation failed for job ${jobId}:`, error);
      throw error;
    }
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<ProjectEvaluationJobData>, error: Error) {
    this.logger.error(
      `Job ${job.id} failed after ${job.attemptsMade} attempts:`,
      error,
    );
    await this.evaluationsService.updateFailedJob(job.data.jobId);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<ProjectEvaluationJobData>) {
    this.logger.log(`Job ${job.id} completed successfully`);
  }
}
