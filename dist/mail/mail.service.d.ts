import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';
export declare class MailService {
    private readonly mailerService;
    private configService;
    constructor(mailerService: MailerService, configService: ConfigService);
    sendMail(to: string[], subject: string, body: string): void;
}
