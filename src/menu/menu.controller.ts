import { Controller, Post, Body } from '@nestjs/common'

import { MenuService } from 'src/menu/menu.service'

@Controller('menu')
export class MenuController {

    constructor(private readonly menuSvc: MenuService) {}

    @Post('qry')
    qry(@Body() dto: Record<string, any>) { return this.menuSvc.qry(dto) }

    @Post('qryChan')
    qryChan(@Body() dto: Record<string, any>) { return this.menuSvc.qryChan(dto) }

    @Post('qryDm')
    qryDm(@Body() dto: Record<string, any>) { return this.menuSvc.qryDm(dto) }

    @Post('qryActivity')
    qryActivity(@Body() dto: Record<string, any>) { return this.menuSvc.qryActivity(dto) }

    @Post('qryPanel')
    qryPanel(@Body() dto: Record<string, any>) { return this.menuSvc.qryPanel(dto) }

    @Post('qryKindCnt')
    qryKindCnt(@Body() dto: Record<string, any>) { return this.menuSvc.qryKindCnt(dto) }    

    @Post('qryPanelCount')
    qryPanelCount(@Body() dto: Record<string, any>) { return this.menuSvc.qryPanelCount(dto) }

    @Post('qryGroup')
    qryGroup(@Body() dto: Record<string, any>) { return this.menuSvc.qryGroup(dto) }

}
