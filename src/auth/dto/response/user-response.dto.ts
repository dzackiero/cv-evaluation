import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'User ID',
  })
  id: string;

  @ApiProperty({
    example: 'user@example.com',
    description: 'Email address',
  })
  email: string;

  @ApiProperty({
    example: 'John Doe',
    description: 'Full name',
  })
  name: string;

  @ApiProperty({
    example: '2025-11-16T10:00:00.000Z',
    description: 'Account creation timestamp',
  })
  createdAt: Date;
}
