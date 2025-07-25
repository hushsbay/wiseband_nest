import { Injectable, NestMiddleware } from '@nestjs/common'
import { Request, Response, NextFunction } from 'express'
import { winstonLogger } from 'src/common/winston.util'

@Injectable()
export class LoggerMiddleware implements NestMiddleware {

    constructor() {}

    use(req: Request, res: Response, next: NextFunction) {
        const { ip, method, originalUrl } = req
        const userAgent = req.get('user-agent')
        res.on('finish', () => {
            const { statusCode } = res
            const str = `[${method}]${originalUrl}(${statusCode}) ${ip} ${userAgent}`
            if (statusCode >= 400 && statusCode < 500) {
                winstonLogger.warn(str)
            } else if (statusCode >= 500) {
                winstonLogger.error(str)            
            } else {
                if (originalUrl.includes('chanmsg/qryDataLogEach')) {
                    //Polling은 콘솔 로그에 들어가면 너무 발리 올라가버려서 정작 중요한 내용은 못봄
                } else {
                    winstonLogger.log(str) 
                }
            }
        })
        next()
    }

}

// import { Inject, Injectable, Logger, LoggerService, NestMiddleware } from '@nestjs/common';
// import { Request, Response, NextFunction } from 'express';
  
// @Injectable()
// export class LoggerMiddleware implements NestMiddleware {
//     constructor(@Inject(Logger) private readonly logger: LoggerService) {}
  
//     use(req: Request, res: Response, next: NextFunction) {
//         const { ip, method, originalUrl } = req;
//         const userAgent = req.get('user-agent');        
//         res.on('finish', () => { //응답이 끝나는 이벤트가 발생하면 로그를 찍음
//              const { statusCode } = res;
//              this.logger.log(`${method} ${originalUrl} ${statusCode} ${ip} ${userAgent}`);
//         })  
//         next()
//     }
// }
