import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { MessageBody, OnGatewayConnection, SubscribeMessage, WebSocketGateway, WebSocketServer, } from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'

@WebSocketGateway({ port: 8080, transports: ['websocket', 'polling'], cors: { origin: '*' }})
export class EventsGateway implements OnGatewayConnection {

    constructor(
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
    ) {}

    @WebSocketServer()
    server: Server

    handleConnection(client: Socket, ...args: any[]) {
        console.log(`$$$$$$$Client connected: ${client.id}`)
        client.emit('welcome', `Hello, client ${client.id}!`)
    }

    afterInit(server: Server) {
        server.use((socket: Socket, next) => {
            console.log(JSON.stringify(socket.handshake.query), "^^^")
            console.log(JSON.stringify(socket.handshake.query.token), "^^^")
            // const authHeader = socket.handshake.headers.authorization
            // if (!authHeader) {
            //     console.log('Authentication failed: No token provided.')
            //     return next(new Error('Authentication failed: No token provided.'))
            // }
            // const [type, token] = authHeader.split(' ')
            // if (type !== 'Bearer' || !token) {
            //     console.log('Authentication failed: Invalid token format.')
            //     return next(new Error('Authentication failed: Invalid token format.'))
            // }
            const token = socket.handshake.query.token as string
            try {
                const secret = this.configService.get<string>('JWT_KEY')
                const decoded = this.jwtService.verify(token, { secret })
                socket['user'] = decoded
                console.log(JSON.stringify(decoded), "++++++++++")
                next()
            } catch (err) {
                console.log('Authentication failed: Invalid token.')
                next(new Error('Authentication failed: Invalid token.'))
            }
        })
    }

    @SubscribeMessage('ClientToServer')
    async handleMessage(@MessageBody() data) {
        console.log(JSON.stringify(data), "############")
        this.server.emit('ServerToClient', data+"123456")
    }

}