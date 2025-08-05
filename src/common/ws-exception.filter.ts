import { Catch, ArgumentsHost, ExceptionFilter } from '@nestjs/common'
import { WsException } from '@nestjs/websockets'
import { Socket } from 'socket.io'

//결국 afterInit in events.gateway.ts에서 잘 안되서 이 파일은 사용하지 않고 있음

@Catch(WsException)
export class WsExceptionFilter implements ExceptionFilter {

    catch(exception: WsException, host: ArgumentsHost) {
        const client = host.switchToWs().getClient<Socket>()
        const errorMessage = exception.getError() as string
        client.emit('error', { message: errorMessage })
    }

}