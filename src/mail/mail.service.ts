import { Injectable } from '@nestjs/common'
import { MailerService } from '@nestjs-modules/mailer'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class MailService {

    constructor(
        private readonly mailerService: MailerService,
        private configService: ConfigService
    ) {}

    public sendMail(to: string, subject: string, body: string): void {
        this.mailerService.sendMail({
            to, //string or array
            from: this.configService.get<string>('MAILER_USER'),
            subject,
            html: body //'<b>welcome</b>' //HTML body content
            //text: body,
            //cc: [ex1@kigo.com, ex2@kigo.com] //참조
            //attachments: attachments //첨부파일
        })
        .then((result) => {
            console.log(result)
        })
        .catch((error) => {
            console.log(error)
        })
    }
}
