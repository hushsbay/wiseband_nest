import { Controller, HttpCode, HttpStatus, Post, Body } from '@nestjs/common'

import { PhotoService } from 'src/photo/photo.service';

@Controller('photo') //photo resource 전체는 테스트용임
export class PhotoController {

    constructor(private readonly photoSvc: PhotoService) {}

    @HttpCode(HttpStatus.OK)
    @Post('qry')
    qry(@Body() dto: Record<string, any>) { return this.photoSvc.qry(dto) }

}
