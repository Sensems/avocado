import { IsEnum, IsString, IsNotEmpty } from 'class-validator';
import { ProjectRole } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class AddProjectMemberDto {
  @ApiProperty({ description: 'The User ID to add to the project' })
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @ApiProperty({ enum: ProjectRole, description: 'Role assigned to this user in the project' })
  @IsEnum(ProjectRole)
  @IsNotEmpty()
  role!: ProjectRole;
}
