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
import { Rubric, RubricSchema } from '../schemas/rubric.schema';
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { fetchWithRetry } from 'src/common/utils/fetch.util';

@Injectable()
export class SystemDocumentsService {
  private readonly logger = new Logger(SystemDocumentsService.name);
  private readonly ragieApiKey: string;
  private readonly ragieApiUrl = 'https://api.ragie.ai';

  constructor(private readonly configService: ConfigService) {
    this.ragieApiKey = this.configService.getOrThrow<string>('RAGIE_API_KEY');
  }

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

  async retrieveDocument(
    docType: SystemDocType,
    query: string,
  ): Promise<string> {
    try {
      const response = await fetchWithRetry(`${this.ragieApiUrl}/retrievals`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.ragieApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          rerank: true,
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
        this.logger.warn(
          `No documents found for type: ${docType} with query: ${query}`,
        );
        throw new BadRequestException(
          `No ${docType} document found for query "${query}". Please upload one first.`,
        );
      }

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
      const ragieMetadata = {
        documentId,
        documentType: metadata.type,
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

  async getJobDescription(jobTitle: string): Promise<string> {
    return this.retrieveDocument(
      SystemDocType.JOB_DESCRIPTION,
      `job description for ${jobTitle}`,
    );
  }

  async getCaseStudy(jobTitle: string): Promise<string> {
    return this.retrieveDocument(
      SystemDocType.CASE_STUDY,
      `case study for ${jobTitle}`,
    );
  }

  async getCvRubric(): Promise<Rubric> {
    this.logger.log('Loading CV rubric from Ragie');

    const rawRubric = await this.retrieveDocument(
      SystemDocType.RUBRIC,
      'CV evaluation rubric criteria',
    );

    this.logger.debug(`Retrieved raw rubric (${rawRubric.length} chars)`);
    const result = await generateObject({
      model: openai('gpt-5-mini'),
      schema: RubricSchema,
      prompt: `Extract the CV evaluation rubric from the following content.

RUBRIC CONTENT:
${rawRubric}

INSTRUCTIONS:
- This is a rubric for evaluating candidate CVs
- Extract each CV evaluation criterion with its name, weight, description, and scoring guide
- Convert criterion names to snake_case format (e.g., "Technical Skills Match" -> "technical_skills_match")
- Keep displayName as the original human-readable format
- Extract the exact scoring descriptions from the rubric
- Weights should be numbers (e.g., 40 for 40%) and must sum to 100%
- Scoring guide must have clear descriptions for CV evaluation scores 1 to 5

Return a structured CV evaluation rubric with all criteria properly weighted.`,
    });

    const rubric = result.object;
    const totalWeight = rubric.criteria.reduce((sum, c) => sum + c.weight, 0);
    this.logger.log(
      `Loaded CV rubric with ${rubric.criteria.length} criteria (total weight: ${totalWeight}%)`,
    );

    if (Math.abs(totalWeight - 100) > 0.1) {
      this.logger.error(
        `CV Rubric weights sum to ${totalWeight}% instead of 100%. This is a fatal error.`,
      );
      throw new InternalServerErrorException(
        `CV Rubric is misconfigured. Weights sum to ${totalWeight}%, not 100%.`,
      );
    }

    return rubric;
  }

  async getProjectRubric(): Promise<Rubric> {
    this.logger.log('Loading project evaluation rubric from RAG');

    const rawRubric = await this.retrieveDocument(
      SystemDocType.RUBRIC,
      'Project evaluation rubric criteria scoring',
    );

    this.logger.debug(`Retrieved raw rubric (${rawRubric.length} chars)`);

    const result = await generateObject({
      model: openai('gpt-5-mini'),
      schema: RubricSchema,
      prompt: `Extract the project evaluation rubric from the following content.

RUBRIC CONTENT:
${rawRubric}

INSTRUCTIONS:
- This is a rubric for evaluating student project reports
- Extract each project evaluation criterion with its name, weight, description, and scoring guide
- Convert criterion names to snake_case format (e.g., "Problem Analysis" -> "problem_analysis")
- Keep displayName as the original human-readable format
- Extract the exact scoring descriptions from the rubric
- Weights should be numbers (e.g., 25 for 25%) and must sum to 100%
- Scoring guide must have clear descriptions for project scores 1 to 5

Return a structured project evaluation rubric with all criteria properly weighted.`,
    });

    const rubric = result.object;
    const totalWeight = rubric.criteria.reduce((sum, c) => sum + c.weight, 0);
    this.logger.log(
      `Loaded project rubric with ${rubric.criteria.length} criteria (total weight: ${totalWeight}%)`,
    );

    if (Math.abs(totalWeight - 100) > 0.1) {
      this.logger.warn(`Rubric weights sum to ${totalWeight}% instead of 100%`);
    }

    return rubric;
  }
}
