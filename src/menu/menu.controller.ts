import { Controller, Post, Body } from '@nestjs/common'

import { MenuService } from 'src/menu/menu.service'

@Controller('menu')
export class MenuController {

    constructor(private readonly menuSvc: MenuService) {}

    @Post('qry')
    qry(@Body() dto: Record<string, any>) { return this.menuSvc.qry(dto) }

    @Post('qryChan')
    qryChan(@Body() dto: Record<string, any>) { return this.menuSvc.qryChan(dto) }

    @Post('qryLater')
    qryLater(@Body() dto: Record<string, any>) { return this.menuSvc.qryLater(dto) }

    @Post('qryKindCnt')
    qryKindCnt(@Body() dto: Record<string, any>) { return this.menuSvc.qryKindCnt(dto) }    

    @Post('qryDm')
    qryDm(@Body() dto: Record<string, any>) { return this.menuSvc.qryDm(dto) }

    @Post('qryLaterCount')
    qryLaterCount(@Body() dto: Record<string, any>) { return this.menuSvc.qryLaterCount(dto) }

}
