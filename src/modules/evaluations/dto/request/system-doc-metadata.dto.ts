import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export enum SystemDocType {
  JOB_DESCRIPTION = 'job_description',
  CASE_STUDY = 'case_study',
  CV_RUBRIC = 'cv_rubric',
  PROJECT_RUBRIC = 'project_rubric',
}

export class SystemDocMetadataDto {
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
