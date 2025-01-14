import { Controller, HttpCode, HttpStatus, Post, Body } from '@nestjs/common'

import { CodeService } from 'src/code/code.service'

@Controller('code')
export class CodeController {

    constructor(private readonly codeSvc: CodeService) {}

    @HttpCode(HttpStatus.OK)
    @Post('qry')
    qry(@Body() dto: Record<string, any>) { return this.codeSvc.qry(dto) }

}
