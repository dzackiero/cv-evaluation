import { ApiProperty } from '@nestjs/swagger';

export enum EvaluationStatus {
  QUEUED = 'queued',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export class EvaluationReportDto {
  @ApiProperty({ example: 0.82 })
  cv_match_rate: number;

  @ApiProperty({
    example:
      'Strong in backend and cloud, limited AI integration experience...',
  })
  cv_feedback: string;

  @ApiProperty({ example: 0.75 })
  project_score: number;

  @ApiProperty({
    example:
      'Meets prompt chaining requirements, lacks error handling robustness...',
  })
  project_feedback: string;

  @ApiProperty({
    example: 'Good candidate fit, would benefit from deeper RAG knowledge...',
  })
  overall_summary: string;
}

export class EvaluationJobResponseDto {
  @ApiProperty({
    description: 'Unique job identifier for tracking evaluation progress',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Current status of the evaluation job',
    enum: EvaluationStatus,
    example: EvaluationStatus.QUEUED,
  })
  status: EvaluationStatus;

  @ApiProperty({
    description: 'Detailed evaluation report once the job is completed',
    type: EvaluationReportDto,
    required: false,
  })
  result?: EvaluationReportDto;
}
