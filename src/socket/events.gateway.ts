import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { MessageBody, OnGatewayConnection, OnGatewayInit, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer, } from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'
import { WsException } from '@nestjs/websockets'
import { Logger, UseFilters } from '@nestjs/common'
import { WsExceptionFilter } from 'src/common/ws-exception.filter'

@WebSocketGateway({ port: 8080, transports: ['websocket', 'polling'], cors: { origin: '*' }})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {

    constructor(
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
    ) {}

    @WebSocketServer()
    server: Server

    private readonly logger = new Logger('EventsGateway')

    handleConnection(socket: Socket, ...args: any[]) {
        console.log(`$$$$$$$Client connected: ${socket.id}`)
        socket.emit('welcome', `Hello, client ${socket.id}!`)
        console.log(`Client connected: ${socket.id}`);
        const token = socket.handshake.query.token as string
        try {
            const secret = this.configService.get<string>('JWT_KEY')
            const decoded = this.jwtService.verify(token, { secret })
            socket['user'] = decoded
            console.log(JSON.stringify(decoded), "++++++++++")
        } catch (err) {
            console.log('Authentication failed: Invalid token.')
            //next(new Error('Authentication failed: Invalid token.')) //reject connection
            //throw new WsException('Invalid token') //서버 죽음. error handling with next() on socket.io nest.js on googling
            socket.emit('error', 'error@@!!')
        }
    }

    /*@UseFilters(new WsExceptionFilter())
    afterInit(server: Server) {
        this.logger.log('WebSocket Gateway initialized!')
        // server.use((socket: Socket, next) => {
        //     //console.log(JSON.stringify(socket.handshake.query.token), "^^^")
        //     // const authHeader = socket.handshake.headers.authorization
        //     // if (!authHeader) {
        //     //     console.log('Authentication failed: No token provided.')
        //     //     return next(new Error('Authentication failed: No token provided.'))
        //     // }
        //     // const [type, token] = authHeader.split(' ')
        //     // if (type !== 'Bearer' || !token) {
        //     //     console.log('Authentication failed: Invalid token format.')
        //     //     return next(new Error('Authentication failed: Invalid token format.'))
        //     // }
            // const token = socket.handshake.query.token as string
            // try {
            //     const secret = this.configService.get<string>('JWT_KEY')
            //     const decoded = this.jwtService.verify(token, { secret })
            //     socket['user'] = decoded
            //     console.log(JSON.stringify(decoded), "++++++++++")
            //     next()
            // } catch (err) {
            //     console.log('Authentication failed: Invalid token.')
            //     //next(new Error('Authentication failed: Invalid token.')) //reject connection
            //     //throw new WsException('Invalid token') //서버 죽음. error handling with next() on socket.io nest.js on googling
            //     //socket.emit('error', 'eeeeeeeeeeeeerrrrrrrrrr')
            // }
        //     socket.on('error', (err) => {
        //         console.error('Socket error:', err.message);
        //         // Example: Disconnect if unauthorized
        //         if (err.message === 'Unauthorized') {
        //             socket.disconnect();
        //         }
        //     })
        // })
        
        server.on('connection', (socket) => {
            console.log(`Client connected: ${socket.id}`);
            const token = socket.handshake.query.token as string
            try {
                const secret = this.configService.get<string>('JWT_KEY')
                const decoded = this.jwtService.verify(token, { secret })
                socket['user'] = decoded
                console.log(JSON.stringify(decoded), "++++++++++")
            } catch (err) {
                console.log('Authentication failed: Invalid token.')
                //next(new Error('Authentication failed: Invalid token.')) //reject connection
                //throw new WsException('Invalid token') //서버 죽음. error handling with next() on socket.io nest.js on googling
                socket.emit('error', 'eeeeeeeeeeeeerrrrrrrrrr')
            }
        })
    }*/

    @SubscribeMessage('ClientToServer')
    async handleMessage(@MessageBody() data) {
        console.log(JSON.stringify(data), "############")
        this.server.emit('ServerToClient', data+"123456")
    }

    handleDisconnect(socket: Socket) {
        console.log(`Client disconnected: ${socket.id}`)
    }

}