import {
  Controller,
  Post,
  Get,
  Param,
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
import { EvaluationJobResponseDto } from '../dto/response/evaluation-job-response.dto';
import { EvaluateCandidateDto } from '../dto/request/evaluate-candidate.dto';
import { EvaluationDocumentsService } from '../services/evaluation-documents.service';
import { UserFilesResponseDto } from '../dto/response/user-files-response.dto';

@UseGuards(JwtAuthGuard)
@Controller()
@ApiBearerAuth()
@ApiTags('evaluations')
export class EvaluationsController {
  constructor(
    private readonly evaluationsService: EvaluationsService,
    private readonly evaluationDocumentService: EvaluationDocumentsService,
  ) {}

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
    const result = await this.evaluationDocumentService.uploadFiles(
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

  @Get('files')
  @ApiOperation({
    summary: 'Get User Uploaded Files',
    description:
      'Retrieve a list of all files uploaded by the authenticated user.',
  })
  @ApiResponse({
    status: 200,
    description: 'User files retrieved successfully',
    type: UserFilesResponseDto,
  })
  async getUserFiles(
    @CurrentUser('id') userId: string,
  ): Promise<UserFilesResponseDto> {
    return await this.evaluationDocumentService.getUserFiles(userId);
  }

  @Post('evaluate')
  @ApiOperation({
    summary: 'Evaluate Candidate',
    description:
      'Initiate evaluation of the candidate based on the uploaded CV and project report.',
  })
  @ApiResponse({
    status: 200,
    description: 'Evaluation job queued successfully',
    type: EvaluationJobResponseDto,
  })
  async evaluateCandidate(
    @CurrentUser('id') userId: string,
    @Body() request: EvaluateCandidateDto,
  ): Promise<EvaluationJobResponseDto> {
    const job = await this.evaluationsService.initializeJob(userId, request);
    return {
      id: job.id,
      status: job.status,
    };
  }

  @Get('result/:id')
  @ApiOperation({
    summary: 'Get Evaluation Result',
    description:
      'Retrieve the evaluation result for a given job ID after processing is complete.',
  })
  @ApiResponse({
    status: 200,
    description: 'Evaluation job result retrieved successfully',
    type: EvaluationJobResponseDto,
  })
  getEvaluationResult(
    @Param('id') jobId: string,
  ): Promise<EvaluationJobResponseDto> {
    return this.evaluationsService.getJobStatus(jobId);
  }
}
