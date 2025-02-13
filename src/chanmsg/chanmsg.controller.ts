import { Controller, HttpCode, HttpStatus, Post, Body } from '@nestjs/common'

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

}
