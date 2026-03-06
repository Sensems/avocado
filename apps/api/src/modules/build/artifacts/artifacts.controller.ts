import { ApiResultResponse } from '../../../common/decorators/api-result.decorator';
import {
  Controller,
  Post,
  Param,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { ArtifactsService } from './artifacts.service';
import { diskStorage } from 'multer';
import * as path from 'path';

@ApiTags('artifacts')
@Controller('artifacts')
export class ArtifactsController {
  constructor(private readonly artifactsService: ArtifactsService) {}

  @Post(':taskId/upload')
  @ApiOperation({ summary: '为任务上传构建产物' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './public/storage/temp',
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
        },
      }),
    }),
  )
  async uploadArtifact(@Param('taskId') taskId: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('必须提供文件');
    }

    // 通常您会生成一个真实的预览 URL。
    // 例如，微信开发者工具的 deep-link 或内部的 H5 地址。
    const previewUrl = `https://dev.example.com/preview/${taskId}`;

    const updatedTask = await this.artifactsService.saveArtifact(taskId, file.path, previewUrl);

    return {
      success: true,
      message: '产物上传成功，并且任务已更新。',
      artifactPath: updatedTask.artifactPath,
      qrcodePath: updatedTask.qrcodePath,
    };
  }
}
