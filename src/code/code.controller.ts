import { Controller, HttpCode, HttpStatus, Post, Body, Get, Query } from '@nestjs/common'

import { Unauth } from 'src/common/unauth.decorator'
import { CodeService } from 'src/code/code.service'

@Controller('code')
export class CodeController {

    constructor(private readonly codeSvc: CodeService) {}

    @Unauth()
    @Get('qryCode')
    qryCode(@Query() dto: Record<string, any>) { return this.codeSvc.qryCode(dto) }

    @Unauth()
    @Get('qryDealer')
    qryDealer(@Query() dto: Record<string, any>) { return this.codeSvc.qryDealer(dto) }

    @Unauth()
    @Get('qryDealerWithPage')
    qryDealerWithPage(@Query() dto: Record<string, any>) { return this.codeSvc.qryDealerWithPage(dto) }

    @Unauth()
    @Get('qryDealerDetail')
    qryDealerDetail(@Query() dto: Record<string, any>) { return this.codeSvc.qryDealerDetail(dto) }

    @Unauth()
    @Post('updateDealer')
    updateDealer(@Body() dto: Record<string, any>) { return this.codeSvc.updateDealer(dto) }

}
