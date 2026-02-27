import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { GitCredentialType } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateGitCredentialDto {
  @ApiProperty({
    description: 'The name of the credential for reference',
    example: 'My Personal SSH Key',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ enum: GitCredentialType, description: 'Type of credential (ssh or https)' })
  @IsEnum(GitCredentialType)
  @IsNotEmpty()
  type!: GitCredentialType;

  @ApiPropertyOptional({
    description: 'Username for HTTPS, not required for SSH',
    example: 'git-user',
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  username?: string;

  @ApiProperty({
    description: 'The actual secret (Private Key or Password/Token)',
    example: '-----BEGIN OPENSSH PRIVATE KEY-----...',
  })
  @IsString()
  @IsNotEmpty()
  secret!: string;
}
