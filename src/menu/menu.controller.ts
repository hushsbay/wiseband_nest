import { Controller, HttpCode, HttpStatus, Post, Body } from '@nestjs/common'

import { MenuService } from 'src/menu/menu.service'

@Controller('menu')
export class MenuController {

    constructor(private readonly menuSvc: MenuService) {}

    @HttpCode(HttpStatus.OK)
    @Post('qry')
    qry(@Body() dto: Record<string, any>) { return this.menuSvc.qry(dto) }

    @HttpCode(HttpStatus.OK)
    @Post('qry')
    qryChan(@Body() dto: Record<string, any>) { return this.menuSvc.qry(dto) }

}
