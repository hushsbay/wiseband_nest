import { Controller, Get, Logger } from '@nestjs/common'

import { AppService } from 'src/app.service'
import { Unauth } from 'src/common/unauth.decorator'


@Controller()
export class AppController {

    constructor(private readonly appService: AppService, private readonly logger: Logger) {}

    @Get()
    getHello(): string {
        // try {
        //     throw new InternalServerErrorException('test');
        // } catch (e) {
        //     this.logger.error("오류발생테스트", e.stack);
        // } //아래는 뒷부분이 먼저 표시됨
        //this.logger.warn('warn', 'warn test', 'cccc', 'dddd') //cccc, dddd는 안됨
        //this.logger.log('log', 'log test')
        //this.logger.debug('debug', 'debug test');
        //throw new InternalServerErrorException(); //아래 행 실행되지 않음
        //hush.throwHttpEx(-1, '오류발생테스트'); //아래 행 실행되지 않음
        return this.appService.getHello()
    }

    @Unauth()
    @Get('/skipauth')
    getUnauth(): void {
        this.logger.log('unauth', 'unauth test')
    }

}
