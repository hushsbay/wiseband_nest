// import { Catch, ArgumentsHost, ExceptionFilter } from '@nestjs/common'
// import { WsException } from '@nestjs/websockets'
// import { Socket } from 'socket.io'

// @Catch(WsException)
// export class WsExceptionFilter implements ExceptionFilter {

//     catch(exception: WsException, host: ArgumentsHost) {
//         const client = host.switchToWs().getClient<Socket>()
//         const errorMessage = exception.getError() as string
//         client.emit('error', { message: errorMessage })
//     }

// }

import { Catch, HttpException } from '@nestjs/common';
import { BaseWsExceptionFilter } from '@nestjs/websockets';

@Catch(HttpException)
export class WsExceptionFilter extends BaseWsExceptionFilter<HttpException> {
  catch(exception: HttpException, host) {
    const socket = host.switchToWs().getClient();
    socket.emit('exception', { data: exception.getResponse() });
  }
}