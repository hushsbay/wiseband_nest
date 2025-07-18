import { Logger } from '@nestjs/common';
import { AppService } from 'src/app.service';
export declare class AppController {
    private readonly appService;
    private readonly logger;
    constructor(appService: AppService, logger: Logger);
}
