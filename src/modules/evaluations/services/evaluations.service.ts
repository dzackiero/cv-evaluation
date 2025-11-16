import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { $Enums } from '../../../../generated/prisma';
import { FileUploadItemDto } from '../dto/response/file-upload-response.dto';

@Injectable()
export class EvaluationsService {
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
}
