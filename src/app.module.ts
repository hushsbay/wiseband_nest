import { ConfigModule } from '@nestjs/config'
import { Logger, MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { APP_FILTER } from '@nestjs/core'
import { TypeOrmModule } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import { addTransactionalDataSource } from 'typeorm-transactional'
import { ServeStaticModule} from '@nestjs/serve-static'
import { join } from 'path'

import appConfig from 'src/app.config' //https://suyeonme.tistory.com/109
import { HttpExceptionFilter } from 'src/common/http-exception.filter'
import { LoggerMiddleware } from 'src/common/logger.middleware'
import { AppController } from 'src/app.controller'
import { AppService } from 'src/app.service'
import { AuthModule } from 'src/auth/auth.module'
import { MenuModule } from 'src/menu/menu.module'
import { UserModule } from 'src/user/user.module'
import { ChanmsgModule } from 'src/chanmsg/chanmsg.module'
import { MailModule } from './mail/mail.module';

@Module({
    imports: [
        ConfigModule.forRoot({ //envFilePath : `.env.${process.env.NODE_ENV}`, //.env 하나로 local/ops 모두 커버
            load : [appConfig], //dbConfig 등 추가 가능하나 일단 하나만으로도 충분
            isGlobal : true
        }),        
        TypeOrmModule.forRootAsync({
            useFactory() {
                const config = appConfig()
                return {
                    type: 'mysql',
                    host: config.mysql.host,
                    port: parseInt(config.mysql.port),
                    username: config.mysql.username,
                    password: config.mysql.password,
                    database: config.mysql.database,
                    autoLoadEntities: true // 각 @Module({imports: [TypeOrmModule.forFeature([User])] 방식으로 반드시 등록되어야 함
                    //synchronize: true, //개발모드만 사용해야 함
                };
            },
            async dataSourceFactory(option) {
                if (!option) throw new Error('Invalid options passed');
                return addTransactionalDataSource(new DataSource(option));
            },
        }),
        ServeStaticModule.forRoot({ //https://dev.to/zakmiller/how-to-serve-vue-with-nest-1e11 향후 운영서버에서 배포를 위한 기본 설정
            rootPath: join(__dirname, '..', 'public') //__dirname이 d:/src/git/wiseband/dist이므로 rootPath는 d:/src/git/wiseband/public (dist폴더는 build시마다 리셋됨)
        }), //여기가 살아나면 localhost에서의 2개 포트 사용을 full test해봐야 함
        AuthModule, UserModule, MenuModule, ChanmsgModule, MailModule
    ],
    controllers: [AppController],
    providers: [
        {
            provide: APP_FILTER,
            useClass: HttpExceptionFilter
        },
        AppService, 
        Logger
    ],
})

export class AppModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer.apply(LoggerMiddleware).forRoutes('*')
    }
}
