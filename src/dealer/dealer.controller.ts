import { Controller, Post, Body, Get, Query } from '@nestjs/common'

import { DealerService } from 'src/dealer/dealer.service'

@Controller('dealer')
export class DealerController {

    constructor(private readonly dealerSvc: DealerService) {}

    @Post('qry')
    qry(@Body() dto: Record<string, any>) { return this.dealerSvc.qry(dto) }

    @Get('qryOne')
    qryOne(@Query() dto: Record<string, any>) { return this.dealerSvc.qryOne(dto) } //링크 용도가 있는 qryOne만 get 방식

    @Post('saveOne')
    saveOne(@Body() dto: Record<string, any>) { return this.dealerSvc.saveOne(dto) }

    @Post('deleteOne')
    deleteOne(@Body() dto: Record<string, any>) { return this.dealerSvc.deleteOne(dto) }

}
