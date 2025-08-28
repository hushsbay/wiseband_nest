import { NestFactory } from '@nestjs/core'
import { initializeTransactionalContext } from 'typeorm-transactional'
import * as cookieParser from 'cookie-parser'
import { AppModule } from 'src/app.module'
import { winstonLogger } from 'src/common/winston.util'
import { RedisIoAdapter } from 'src/socket/redis-io.adapter' //import { RedisIoAdapter } from 'src/socket/redis-io.adapter1' //##1
import * as hush from 'src/common/common'

async function bootstrap() {

    const corsList = hush.cons.corsOrigin //['https://hushsbay.com:446', 'http://localhost:5173'] //Postman, MobileApp 등에서는 cors 설정이 없어도 들어올 수 있으므로 설정으로 모두 막을 수 없음
    
    initializeTransactionalContext()
    
    const app = await NestFactory.create(AppModule, { //https://cdragon.tistory.com/entry/NestJS-Logging-%EC%95%8C%EC%95%84%EB%B3%B4%EA%B8%B0-feat-winston
        logger: winstonLogger,      
        bufferLogs: true // 부트스트래핑 과정까지 nest-winston 로거 사용
    })

    //app.useGlobalFilters(new HttpExceptionFilter()); //대신 app.module.ts에 적용
    //app.setGlobalPrefix('api') //@controller(api/auth/login) => @controller(auth/login)로 사용 가능 (다른 nestjs 서버를 같은 서버에 놓을 때 api말고 다른 것으로 하면 될 듯)
    app.enableCors({ origin: corsList, credentials: true }) //credentials 없으면 CORS Error 발생. vue의 main.js axios withCredential도 필요 (쿠키 공유) 
    app.use(cookieParser())

    const redisIoAdapter = new RedisIoAdapter(app)
    await redisIoAdapter.connectToRedis()
    app.useWebSocketAdapter(redisIoAdapter) //app.useWebSocketAdapter(new RedisIoAdapter(app)) //##1

    const server = app.getHttpServer() //AWS CLB Timeout은 60초이므로 그보다 짧으면 60초전에도 504 오류 발생함
    server.keepAliveTimeout = 60001 //60 seconds keep-alive timeout
    server.headersTimeout = 60001 //61 seconds headers timeout (should be a bit more than keepAliveTimeout)
    await app.listen(process.env.NODE_PORT)

}

bootstrap()
