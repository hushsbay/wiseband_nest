import { NestFactory } from '@nestjs/core'
import { initializeTransactionalContext } from 'typeorm-transactional'
import * as cookieParser from 'cookie-parser'
import { AppModule } from 'src/app.module'
import { winstonLogger } from 'src/common/winston.util'
import { RedisIoAdapter } from 'src/socket/redis-io.adapter' //import { RedisIoAdapter } from 'src/socket/redis-io.adapter1' //##1

async function bootstrap() {

    //https://inpa.tistory.com/entry/AXIOS-%F0%9F%93%9A-CORS-%EC%BF%A0%ED%82%A4-%EC%A0%84%EC%86%A1withCredentials-%EC%98%B5%EC%85%98
    //https://blog.thereed.io/main/25/article/%5BNestJS%5D%20%EC%9A%94%EC%B2%AD%EC%97%90%EC%84%9C%20withCredentials%20%EC%82%AC%EC%9A%A9%ED%95%A0%20%EB%95%8C%20%EC%84%9C%EB%B2%84%EC%97%90%EC%84%9C%20origin%EC%9D%84%20%EC%99%80%EC%9D%BC%EB%93%9C%EC%B9%B4%EB%93%9C%28*%29%EB%A1%9C%20%EC%82%AC%EC%9A%A9%ED%95%98%EB%A9%B4%20%EC%95%88%20%EB%90%A8-443bc8678f7ab0a9adc8eaebb04d34b8
    //const corsList = ['http://127.0.0.1:5173', 'http://localhost:5173'] //Postman, MobileApp 등에서는 cors 설정이 없어도 들어올 수 있으므로 설정으로 모두 막을 수 없음 //'http://10.10.221.214:5173'
    const corsList = ['https://hushsbay.com:444', 'https://hushsbay.com:446', 'http://127.0.0.1:5173', 'http://localhost:5173']

    initializeTransactionalContext()

    //https://cdragon.tistory.com/entry/NestJS-Logging-%EC%95%8C%EC%95%84%EB%B3%B4%EA%B8%B0-feat-winston
    const app = await NestFactory.create(AppModule, {
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

    //const server = app.getHttpServer() //Set Keep-Alive and header timeouts (in milliseconds)
    //server.keepAliveTimeout = 30000 // 30 seconds keep-alive timeout
    //server.headersTimeout = 31000 // 31 seconds headers timeout (should be a bit more than keepAliveTimeout)
    await app.listen(process.env.NODE_PORT)

}

bootstrap()
