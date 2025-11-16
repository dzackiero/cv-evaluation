import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class EvaluateCandidateDto {
  @ApiProperty({
    description: 'Job title for the candidate evaluation',
    example: 'Software Engineer',
  })
  @IsString()
  @IsNotEmpty()
  jobTitle: string;

  @ApiProperty({
    description: 'ID of the uploaded CV file from Ragie',
    example: 'ragie_doc_abc123',
  })
  @IsString()
  @IsNotEmpty()
  cvFileId: string;

  @ApiProperty({
    description: 'ID of the uploaded project report file from Ragie',
    example: 'ragie_doc_xyz789',
  })
  @IsString()
  @IsNotEmpty()
  projectFileId: string;
}
