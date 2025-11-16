import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EvaluationsService } from '../services/evaluations.service';

export interface OverallScoringJobData {
  jobId: string;
}

@Processor('overall-scoring', {
  concurrency: 5,
})
export class OverallScoringProcessor extends WorkerHost {
  private readonly logger = new Logger(OverallScoringProcessor.name);

  constructor(private readonly evaluationsService: EvaluationsService) {
    super();
  }

  async process(job: Job<OverallScoringJobData>): Promise<void> {
    const { jobId } = job.data;
    this.logger.log(`Processing overall scoring for job ${jobId}`);

    try {
      await this.evaluationsService.evaluateCandidate(jobId);
      this.logger.log(`Overall scoring completed for job ${jobId}`);
    } catch (error) {
      this.logger.error(`Overall scoring failed for job ${jobId}:`, error);
      throw error;
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<OverallScoringJobData>, error: Error) {
    this.logger.error(
      `Job ${job.id} failed after ${job.attemptsMade} attempts:`,
      error,
    );
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<OverallScoringJobData>) {
    this.logger.log(`Job ${job.id} completed successfully`);
  }
}
