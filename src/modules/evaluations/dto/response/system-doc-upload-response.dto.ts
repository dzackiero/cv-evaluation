import { ApiProperty } from '@nestjs/swagger';
import { SystemDocMetadataDto } from '../request/system-doc-metadata.dto';

export class UploadedDocumentDto {
  @ApiProperty({
    description: 'Ragie document ID',
    example: 'ragie_doc_123456',
  })
  ragieId: string;

  @ApiProperty({
    description: 'Original filename',
    example: 'job-description.pdf',
  })
  filename: string;

  @ApiProperty({
    description: 'Document metadata with auto-generated ID',
    example: {
      id: 'job-desc-1731744000000',
      type: 'job_description',
      version: '1.0',
    },
  })
  metadata: SystemDocMetadataDto & { id: string };
}

export class SystemDocUploadResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'System documents uploaded successfully',
  })
  message: string;

  @ApiProperty({
    description: 'List of uploaded documents',
    type: UploadedDocumentDto,
  })
  document: UploadedDocumentDto;
}
