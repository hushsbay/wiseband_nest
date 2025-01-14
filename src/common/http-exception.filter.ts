import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from '@nestjs/common'
import { Request, Response } from 'express'

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter { //200(OK), 404 등등..

    catch(exception: HttpException, host: ArgumentsHost) { //common.ts의 throwEx() 참조
        const ctx = host.switchToHttp()
        const response = ctx.getResponse<Response>()
        const request = ctx.getRequest<Request>()
        const status = exception.getStatus()            
        const cause = exception.cause //unknown type이므로 바로 구조분해시 오류 발생하여 아래와 같이 codeMsg로 변환해 처리
        let codeMsg = { code: '-1', msg: ''}
        if (cause) {
            codeMsg = JSON.parse(JSON.stringify(cause))
        } else { //실제로 404(not found) 등에는 cause가 없는데 일단 오류 방지를 위해 코딩한 것임
            codeMsg.code = status.toString()
            codeMsg.msg = request.url
        }
        response.status(status).json({
            statusCode: status,
            path: request.url,
            code: codeMsg.code ?? '-1',
            msg: codeMsg.msg ?? '알 수 없는 오류'
            //1. 웹브라우저에서 호출시 서버에서 HttpException을 발생시키면 이미 Response로 보낸다는 것을 의미
            //2. 클라이언트에서는 statusCode와 message만 있으면 부족함 (타이핑도 개발자가 너무 불편) : 공통적으로 code와 msg를 사용 (오류이든 아니든 적용)
            //timestamp: new Date().toISOString(),            
            //message: exception.message,
            //error: cause
        })
    }

}
