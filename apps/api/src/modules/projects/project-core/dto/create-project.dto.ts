import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsUUID,
  IsArray,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FrameworkType } from '@prisma/client';

export class CreateProjectDto {
  @ApiProperty({ description: 'Project name', example: 'Avocado Frontend' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ description: 'Mini Program App ID', example: 'wx1234567890abcdef' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  appId?: string;

  @ApiProperty({ description: 'Git repository URL', example: 'git@github.com:my/repo.git' })
  @IsString()
  @IsNotEmpty()
  repositoryUrl!: string;

  @ApiPropertyOptional({ description: 'The GitCredential ID attached to this project' })
  @IsUUID()
  @IsOptional()
  gitCredentialId?: string;

  @ApiPropertyOptional({
    description: 'The private key content for WeChat Mini Program upload',
    example: '-----BEGIN RSA PRIVATE KEY-----\n...',
  })
  @IsString()
  @IsOptional()
  privateKey?: string;

  @ApiPropertyOptional({ description: 'Array of IM Robot IDs to send build notifications to' })
  @IsArray()
  @IsUUID('all', { each: true })
  @IsOptional()
  imRobotIds?: string[];

  @ApiPropertyOptional({
    description: 'Framework type',
    enum: FrameworkType,
    default: FrameworkType.native,
  })
  @IsEnum(FrameworkType)
  @IsOptional()
  framework?: FrameworkType;
}
