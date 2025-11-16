import { ApiProperty } from '@nestjs/swagger';

export class FileUploadItemDto {
  @ApiProperty({
    description: 'Unique identifier for the uploaded file',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Original filename',
    example: 'john_doe_cv.pdf',
  })
  filename: string;

  @ApiProperty({
    description: 'File type',
    enum: ['CV', 'PROJECT_REPORT'],
    example: 'CV',
  })
  type: string;

  @ApiProperty({
    description: 'File storage path/key',
    example: 'files/user-123/cv/550e8400-e29b-41d4-a716-446655440000.pdf',
  })
  path: string;

  @ApiProperty({
    description: 'Upload timestamp',
    example: '2025-11-16T10:30:00.000Z',
  })
  createdAt: Date;
}

export class UploadResponseDto {
  @ApiProperty({
    description: 'Response message',
    example: 'Files uploaded successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Uploaded CV file details',
    type: FileUploadItemDto,
  })
  cv: FileUploadItemDto;

  @ApiProperty({
    description: 'Uploaded project report file details',
    type: FileUploadItemDto,
  })
  report: FileUploadItemDto;
}
