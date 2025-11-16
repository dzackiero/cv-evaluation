import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
  UseGuards,
  Body,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { EvaluationsService } from '../services/evaluations.service';
import { UploadResponseDto } from '../dto/response/file-upload-response.dto';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import {
  EvaluationJobResponseDto,
  EvaluationStatus,
} from '../dto/response/evaluation-job-response.dto';
import { EvaluateCandidateDto } from '../dto/request/evaluate-candidate.dto';

@UseGuards(JwtAuthGuard)
@Controller()
@ApiBearerAuth()
@ApiTags('evaluations')
export class EvaluationsController {
  constructor(private readonly evaluationsService: EvaluationsService) {}

  @Post('upload')
  @ApiOperation({
    summary: 'Upload CV and Project Report',
    description:
      'Upload candidate CV and project report PDF files for evaluation. Both files are required.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['cv', 'report'],
      properties: {
        cv: {
          type: 'string',
          format: 'binary',
          description: 'Candidate CV file (PDF only)',
        },
        report: {
          type: 'string',
          format: 'binary',
          description: 'Project report file (PDF only)',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Files uploaded successfully',
    type: UploadResponseDto,
  })
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'cv', maxCount: 1 },
      { name: 'report', maxCount: 1 },
    ]),
  )
  async uploadFiles(
    @CurrentUser('id') userId: string,
    @UploadedFiles()
    files: {
      cv?: Express.Multer.File[];
      report?: Express.Multer.File[];
    },
  ): Promise<UploadResponseDto> {
    if (!files?.cv?.[0]) {
      throw new BadRequestException('CV file is required');
    }
    if (!files?.report?.[0]) {
      throw new BadRequestException('Project report file is required');
    }
    const cvFile = files.cv[0];
    const reportFile = files.report[0];
    const result = await this.evaluationsService.uploadFiles(
      userId,
      cvFile,
      reportFile,
    );

    return {
      message: 'Files uploaded successfully',
      cv: result.cv,
      report: result.report,
    };
  }

  @Post('evaluate')
  @ApiResponse({
    status: 200,
    description: 'Evaluation job queued successfully',
    type: EvaluationJobResponseDto,
  })
  evaluateCandidate(
    @CurrentUser('id') userId: string,
    @Body() request: EvaluateCandidateDto,
  ): EvaluationJobResponseDto {
    return {
      id: userId,
      status: EvaluationStatus.QUEUED,
    };
  }

  @Post('result/:id')
  @ApiResponse({
    status: 200,
    description: 'Evaluation job result retrieved successfully',
    type: EvaluationJobResponseDto,
  })
  getEvaluationResult(
    @CurrentUser('id') userId: string,
  ): EvaluationJobResponseDto {
    return {
      id: userId,
      status: EvaluationStatus.COMPLETED,
      result: {
        cv_match_rate: 0.85,
        cv_feedback: 'Strong skills demonstrated in backend development.',
        project_score: 0.9,
        project_feedback: 'Excellent project report with clear documentation.',
        overall_summary: 'Candidate shows strong skills in both areas.',
      },
    };
  }
}
