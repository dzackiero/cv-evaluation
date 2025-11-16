import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { SystemDocType } from './system-doc-metadata.dto';

export class UploadSystemDocDto {
  @ApiProperty({
    description: 'Type of the system document',
    enum: SystemDocType,
    example: SystemDocType.JOB_DESCRIPTION,
  })
  @IsEnum(SystemDocType)
  @IsNotEmpty()
  type: SystemDocType;

  @ApiProperty({
    description: 'Optional version identifier',
    example: '1.0',
    required: false,
  })
  @IsString()
  @IsOptional()
  version?: string;
}
