import { Controller, HttpCode, HttpStatus, Post, Body } from '@nestjs/common'
import { PhotoMetaService } from 'src/photometa/photometa.service';

@Controller('photometa') //photometa resource 전체는 테스트용임
export class PhotometaController {

  constructor(private readonly photometaSvc: PhotoMetaService) {}

  @HttpCode(HttpStatus.OK)
    @Post('qry')
    qry(@Body() dto: Record<string, any>) { return this.photometaSvc.qry(dto) }

}
