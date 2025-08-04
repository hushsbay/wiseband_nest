import { MessageBody, OnGatewayConnection, SubscribeMessage, WebSocketGateway, WebSocketServer, } from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'

@WebSocketGateway({ port: 8080, transports: ['websocket', 'polling'], cors: { origin: '*' }})
export class EventsGateway implements OnGatewayConnection {

    @WebSocketServer()
    server: Server

    handleConnection(client: Socket, ...args: any[]) {
        console.log(`$$$$$$$Client connected: ${client.id}`)
        client.emit('welcome', `Hello, client ${client.id}!`)
    }

    @SubscribeMessage('ClientToServer')
    async handleMessage(@MessageBody() data) {
        console.log(JSON.stringify(data), "############")
        this.server.emit('ServerToClient', data+"123456")
    }

}