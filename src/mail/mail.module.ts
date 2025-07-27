import { Module } from '@nestjs/common'
import { MailerModule } from '@nestjs-modules/mailer'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { MailService } from 'src/mail/mail.service'

//https://iamiet.tistory.com/entry/Nodemailer-Gmail-OAuth20%EC%9C%BC%EB%A1%9C-%EC%9D%B4%EB%A9%94%EC%9D%BC-%EB%B0%9C%EC%86%A1%EA%B8%B0%EB%8A%A5-%EA%B5%AC%ED%98%84%ED%95%98%EA%B8%B0
//https://console.cloud.google.com, https://console.cloud.google.com/apis, https://developers.google.com/oauthplayground
//https://ek12mv2.tistory.com/368

@Module({
    imports: [
        ConfigModule,
        MailerModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: async (configService: ConfigService) => ({
                transport: {
                    service: 'gmail',
                    host: 'smtp.gmail.com',
                    port: 465, //OAuth2 Connection
                    secure: true,
                    auth: {
                        type: 'OAuth2',
                        user: configService.get<string>('MAILER_USER'),
                        clientId: configService.get<string>('MAILER_CLIENT_ID'),
                        clientSecret: configService.get<string>('MAILER_CLIENT_SECRET'),
                        refreshToken: configService.get<string>('MAILER_REFRESH_TOKEN'),
                    },
                },
                defaults: {
                    from: '"No-Reply" <no-reply@localhost>',
                },
            }),
        }),
    ],
    providers: [MailService],
    exports: [MailService]
})

export class MailModule {}