import { Injectable } from '@nestjs/common'
import { MailerService } from '@nestjs-modules/mailer'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class MailService {

    constructor(
        private readonly mailerService: MailerService,
        private configService: ConfigService
    ) {}

    public sendMail(to: string[], subject: string, body: string): void {
        this.mailerService.sendMail({
            to, //string or array
            from: this.configService.get<string>('MAILER_USER'),
            subject,
            html: body //'<b>welcome</b>'
            //text: body,
            //cc: [ex1@kigo.com, ex2@kigo.com]
            //attachments: attachments
        })
        .then((result) => {
            console.log('mailerService ok: ', result)
        })
        .catch((error) => {
            console.log('mailerService error: ', error)
        })
    }
}
