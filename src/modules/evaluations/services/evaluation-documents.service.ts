import {
  Injectable,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { $Enums, FileType } from '../../../../generated/prisma';
import { FileUploadItemDto } from '../dto/response/file-upload-response.dto';
import { UserFilesResponseDto } from '../dto/response/user-files-response.dto';
import { PDFParse } from 'pdf-parse';

@Injectable()
export class EvaluationDocumentsService {
  private readonly logger = new Logger(EvaluationDocumentsService.name);
  private readonly MAX_SIZE_BYTES = 10 * 1024 * 1024;

  constructor(
    private readonly storageService: StorageService,
    private readonly prisma: PrismaService,
  ) {}

  async uploadFiles(
    userId: string,
    cvFile: Express.Multer.File,
    reportFile: Express.Multer.File,
  ): Promise<{ cv: FileUploadItemDto; report: FileUploadItemDto }> {
    if (cvFile.mimetype !== 'application/pdf') {
      throw new BadRequestException('CV file must be a PDF');
    }
    if (reportFile.mimetype !== 'application/pdf') {
      throw new BadRequestException('Project report file must be a PDF');
    }

    if (reportFile.size > this.MAX_SIZE_BYTES) {
      throw new BadRequestException(
        `Project report file must be smaller than ${this.MAX_SIZE_BYTES}`,
      );
    }

    const cvPath = `files/${userId}/cv/${Date.now()}-${cvFile.originalname}`;
    const reportPath = `files/${userId}/report/${Date.now()}-${reportFile.originalname}`;

    try {
      const [cvUploadResult, reportUploadResult] = await Promise.all([
        this.storageService.upload(cvFile.buffer, cvPath, {
          contentType: cvFile.mimetype,
          metadata: {
            userId,
            originalName: cvFile.originalname,
            type: 'CV',
          },
        }),
        this.storageService.upload(reportFile.buffer, reportPath, {
          contentType: reportFile.mimetype,
          metadata: {
            userId,
            originalName: reportFile.originalname,
            type: 'PROJECT_REPORT',
          },
        }),
      ]);

      const [cvFileRecord, reportFileRecord] = await Promise.all([
        this.prisma.file.create({
          data: {
            userId,
            filename: cvFile.originalname,
            path: cvUploadResult.key,
            type: $Enums.FileType.CV,
          },
        }),
        this.prisma.file.create({
          data: {
            userId,
            filename: reportFile.originalname,
            path: reportUploadResult.key,
            type: $Enums.FileType.PROJECT_REPORT,
          },
        }),
      ]);

      return {
        cv: {
          id: cvFileRecord.id,
          filename: cvFileRecord.filename,
          type: cvFileRecord.type,
          path: cvFileRecord.path,
          createdAt: cvFileRecord.createdAt,
        },
        report: {
          id: reportFileRecord.id,
          filename: reportFileRecord.filename,
          type: reportFileRecord.type,
          path: reportFileRecord.path,
          createdAt: reportFileRecord.createdAt,
        },
      };
    } catch (error) {
      await Promise.allSettled([
        this.storageService.delete(cvPath),
        this.storageService.delete(reportPath),
      ]);
      throw error;
    }
  }

  async getUserFiles(userId: string): Promise<UserFilesResponseDto> {
    const files = await this.prisma.file.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        filename: true,
        type: true,
        path: true,
        createdAt: true,
      },
    });

    return {
      total: files.length,
      files,
    };
  }

  async loadFileContent(
    fileId: string,
    userId: string,
    type?: FileType,
  ): Promise<string> {
    const file = await this.prisma.file.findFirst({
      where: {
        id: fileId,
        userId,
        type: type ?? undefined,
      },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    return this.extractTextFromPdf(file.path);
  }

  private async extractTextFromPdf(filePath: string): Promise<string> {
    let parser: PDFParse | null = null;
    try {
      this.logger.debug(`Extracting text from PDF: ${filePath}`);

      const url = await this.storageService.getUrl(filePath);
      parser = new PDFParse({ url });
      const result = await parser.getText();

      if (!result.text || result.text.trim().length === 0) {
        this.logger.warn(`No text extracted from PDF: ${filePath}`);
        throw new BadRequestException(
          'PDF file appears to be empty or contains no extractable text',
        );
      }

      this.logger.debug(
        `Extracted ${result.text.length} characters from PDF: ${filePath}`,
      );

      return result.text.trim();
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(`Failed to extract text from PDF: ${error}`);
      throw new InternalServerErrorException(
        'Failed to extract text from PDF file',
      );
    } finally {
      if (parser) {
        await parser.destroy();
      }
    }
  }
}
