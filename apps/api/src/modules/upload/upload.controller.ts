// InfFinanceMs - 文件上传控制器

import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Query,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from "@nestjs/swagger";
import { UploadService } from "./upload.service";
import { JwtAuthGuard } from "../../common/guards";
import { buildSingleFileInterceptorOptions } from "../../common/utils/upload.utils";

@ApiTags("文件上传")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("upload")
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @ApiOperation({ summary: "上传文件" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: {
          type: "string",
          format: "binary",
          description: "要上传的文件",
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor(
      "file",
      buildSingleFileInterceptorOptions([
        ".pdf",
        ".jpg",
        ".jpeg",
        ".png",
        ".gif",
        ".doc",
        ".docx",
      ]),
    ),
  )
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Query("category") category: string = "temp",
  ) {
    if (!file) {
      throw new BadRequestException("请选择要上传的文件");
    }

    return this.uploadService.saveFile(file, category);
  }
}
