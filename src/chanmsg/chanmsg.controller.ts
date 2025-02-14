import { Controller, HttpCode, HttpStatus, Post, Body, UseInterceptors, UploadedFile } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express/multer'

import { ChanmsgService } from './chanmsg.service'

@Controller('chanmsg')
export class ChanmsgController {

    constructor(private readonly chanmsgService: ChanmsgService) {}

    @HttpCode(HttpStatus.OK)
    @Post('qry')
    qry(@Body() dto: Record<string, any>) { return this.chanmsgService.qry(dto) }

    @HttpCode(HttpStatus.OK)
    @Post('saveMsg')
    saveMsg(@Body() dto: Record<string, any>) { return this.chanmsgService.saveMsg(dto) }

    @Post('uploadBlob')
    @UseInterceptors(FileInterceptor('file'))
    uploadBlob(@Body() dto: Record<string, any>, @UploadedFile() file: Express.Multer.File) {
        console.log('@@@@', file)
        return this.chanmsgService.uploadBlob(dto, file)
    }

}
