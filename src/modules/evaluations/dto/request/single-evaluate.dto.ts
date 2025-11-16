import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class SingleEvaluateDto {
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
  fileId: string;
}
