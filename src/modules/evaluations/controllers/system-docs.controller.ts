import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  UseGuards,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiResponse,
  ApiSecurity,
} from '@nestjs/swagger';
import { SystemDocsService } from '../services/system-docs.service';
import { SystemDocUploadResponseDto } from '../dto/response/system-doc-upload-response.dto';
import { UploadSystemDocDto } from '../dto/request/upload-system-doc.dto';
import { ApiKeyGuard } from '../../../auth/guards/api-key.guard';

@ApiTags('system-docs')
@Controller('system-docs')
@ApiSecurity('api-key')
@UseGuards(ApiKeyGuard)
export class SystemDocsController {
  constructor(private readonly systemDocsService: SystemDocsService) {}

  @Post()
  @ApiOperation({
    summary: 'Upload System Internal Document',
    description:
      'Upload a system internal document (e.g., job description, rubric)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'type'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'System document file (PDF only)',
        },
        type: {
          type: 'string',
          enum: [
            'job_description',
            'case_study',
            'cv_rubric',
            'project_rubric',
          ],
          description: 'Type of the system document',
        },
        version: {
          type: 'string',
          description: 'Optional version identifier',
          example: '1.0',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'System document uploaded successfully',
    type: SystemDocUploadResponseDto,
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadSystemDocument(
    @UploadedFile() file: Express.Multer.File,
    @Body() uploadDto: UploadSystemDocDto,
  ): Promise<SystemDocUploadResponseDto> {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const uploadedDocument = await this.systemDocsService.uploadSystemDocument(
      file,
      uploadDto,
    );

    return {
      message: 'System document uploaded successfully',
      document: uploadedDocument,
    };
  }
}
