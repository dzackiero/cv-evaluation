import { ApiProperty } from '@nestjs/swagger';
import { FileType } from '../../../../../generated/prisma';

export class UserFileItemDto {
  @ApiProperty({
    description: 'Unique identifier for the file',
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
    enum: FileType,
    example: FileType.CV,
  })
  type: FileType;

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

export class UserFilesResponseDto {
  @ApiProperty({
    description: 'Total number of files',
    example: 5,
  })
  total: number;

  @ApiProperty({
    description: 'List of uploaded files',
    type: [UserFileItemDto],
  })
  files: UserFileItemDto[];
}
