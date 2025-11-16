import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SystemDocMetadataDto,
  SystemDocType,
} from '../dto/request/system-doc-metadata.dto';
import { UploadSystemDocDto } from '../dto/request/upload-system-doc.dto';
import { UploadedDocumentDto } from '../dto/response/system-doc-upload-response.dto';
import { RagieRetrievalResponse } from '../dto/response/ragie/ragie-retreival-response.dto';
import { RagieUploadResponse } from '../dto/response/ragie/ragie-upload-response.dto';

@Injectable()
export class SystemDocsService {
  private readonly logger = new Logger(SystemDocsService.name);
  private readonly ragieApiKey: string;
  private readonly ragieApiUrl = 'https://api.ragie.ai';

  constructor(private readonly configService: ConfigService) {
    this.ragieApiKey = this.configService.getOrThrow<string>('RAGIE_API_KEY');
  }

  /**
   * Upload a single system document to Ragie
   * @param file - The file to upload
   * @param uploadDto - Upload DTO containing type and version
   * @returns Promise of uploaded document info
   */
  async uploadSystemDocument(
    file: Express.Multer.File,
    uploadDto: UploadSystemDocDto,
  ): Promise<UploadedDocumentDto> {
    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('File must be a PDF');
    }

    const metadata: SystemDocMetadataDto = {
      type: uploadDto.type,
      version: uploadDto.version,
    };

    try {
      const result = await this.uploadToRagie(file, metadata);
      this.logger.log('Successfully uploaded document to Ragie');
      return result;
    } catch (error) {
      this.logger.error('Failed to upload document to Ragie', error);
      throw new InternalServerErrorException(
        'Failed to upload document to Ragie',
      );
    }
  }

  /**
   * Generic method to retrieve document content by type from Ragie
   * @param docType - Type of document to retrieve
   * @param query - Search query for retrieval
   * @returns Promise of document content
   */
  async retrieveDocument(
    docType: SystemDocType,
    query: string,
  ): Promise<string> {
    try {
      const response = await fetch(`${this.ragieApiUrl}/retrievals`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.ragieApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          filter: {
            documentType: docType,
          },
          top_k: 5,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `Ragie retrieval error for ${docType}: ${response.status} - ${errorText}`,
        );
        throw new Error(`Ragie retrieval error: ${response.status}`);
      }

      const result = (await response.json()) as RagieRetrievalResponse;

      if (!result.scored_chunks || result.scored_chunks.length === 0) {
        this.logger.warn(`No documents found for type: ${docType}`);
        throw new BadRequestException(
          `No ${docType} document found. Please upload one first.`,
        );
      }

      // Combine all chunks into a single content string
      const content = result.scored_chunks
        .sort((a, b) => b.score - a.score)
        .map((chunk) => chunk.text)
        .join('\n\n');

      this.logger.log(
        `Retrieved ${result.scored_chunks.length} chunks for ${docType}`,
      );

      return content;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Failed to retrieve ${docType} from Ragie`, error);
      throw new InternalServerErrorException(
        `Failed to retrieve ${docType} from Ragie`,
      );
    }
  }

  /**
   * Get the evaluation target based on document type
   * @param type - Document type
   * @returns Target evaluation context ('cv' or 'project')
   */
  private getTargetFromType(type: SystemDocType): 'cv' | 'project' {
    switch (type) {
      case SystemDocType.JOB_DESCRIPTION:
      case SystemDocType.CV_RUBRIC:
        return 'cv';
      case SystemDocType.CASE_STUDY:
      case SystemDocType.PROJECT_RUBRIC:
        return 'project';
    }
  }

  /**
   * Upload a single document to Ragie using REST API
   * @param file - The file to upload
   * @param metadata - Document metadata
   * @returns Promise of uploaded document info
   */
  private async uploadToRagie(
    file: Express.Multer.File,
    metadata: SystemDocMetadataDto,
  ): Promise<UploadedDocumentDto> {
    try {
      const formData = new FormData();
      const uint8Array = new Uint8Array(file.buffer);
      const blob = new Blob([uint8Array], { type: file.mimetype });
      formData.append('file', blob, file.originalname);

      const documentId = crypto.randomUUID();
      const target = this.getTargetFromType(metadata.type);
      const ragieMetadata = {
        documentId,
        documentType: metadata.type,
        evaluationTarget: target,
        ...(metadata.version && { version: metadata.version }),
        uploadedAt: new Date().toISOString(),
      };
      formData.append('metadata', JSON.stringify(ragieMetadata));

      const response = await fetch(`${this.ragieApiUrl}/documents`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.ragieApiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `Ragie API error for ${file.originalname}: ${response.status} - ${errorText}`,
        );
        throw new Error(`Ragie API error: ${response.status}`);
      }

      const result = (await response.json()) as RagieUploadResponse;

      this.logger.log(
        `Document uploaded to Ragie: ${file.originalname} (Doc ID: ${documentId}, Ragie ID: ${result.id})`,
      );

      return {
        ragieId: result.id,
        filename: file.originalname,
        metadata: {
          id: documentId,
          type: metadata.type,
          target,
          version: metadata.version || 'v1.0',
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to upload ${file.originalname} to Ragie`,
        error,
      );
      throw error;
    }
  }
}
