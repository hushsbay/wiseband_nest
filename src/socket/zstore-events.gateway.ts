import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { MessageBody, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer, ConnectedSocket, } from '@nestjs/websockets' //OnGatewayInit
import { Server, Socket } from 'socket.io'
import { WsException } from '@nestjs/websockets'
import { Logger, UseFilters } from '@nestjs/common'
import { WsExceptionFilter } from 'src/common/ws-exception.filter'
import * as hush from 'src/common/common'

@WebSocketGateway({ 
    port: 8080, 
    transports: ['websocket', 'polling'], 
    cors: { origin: '*' }, 
    namespace: hush.cons.appName,
    pingTimeout: 5000, 
    pingInterval: 25000
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {

    constructor(
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
    ) {}

    @WebSocketServer()
    server: Server

    private readonly logger = new Logger('EventsGateway')

    handleConnection(socket: Socket, ...args: any[]) { //OnGatewayConnection에서 필요한 메소드
        console.log(`$$$$$$$Client connected: ${socket.id}`)
        socket.emit('welcome', `Hello, client ${socket.id}!`)
    }

    //@UseFilters(new WsExceptionFilter()) //작동안됨
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
            // socket.on('error', (err) => {
            //     console.error('Socket error:', err.message);
            //     // Example: Disconnect if unauthorized
            //     if (err.message === 'Unauthorized') {
            //         socket.disconnect();
            //     }
            // })
        // })        
        server.on('connection', (socket) => { //afterInit server.on socket.io on nest.js = googling
            console.log(`Client connected: ${socket.id}`);
            const token = socket.handshake.query.token as string
            try {
                const secret = this.configService.get<string>('JWT_KEY')
                const decoded = this.jwtService.verify(token, { secret })
                socket['user'] = decoded
                console.log(JSON.stringify(decoded), "++++++++++")
                //redis setting

                socket.on('error', (err) => {
                    console.error('Socket error:', err.message);
                    // Example: Disconnect if unauthorized
                    if (err.message === 'Unauthorized') {
                        socket.disconnect();
                    }
                })
            } catch (err) {
                console.log('Authentication failed: Invalid token.')
                //next(new Error('Authentication failed: Invalid token.')) //reject connection
                //throw new WsException('Invalid token') //서버 죽음. error handling with next() on socket.io nest.js on googling
                socket.emit('error', 'eeeeeeeeeeeeerrrrrrrrrr')
            }
        })
    }

    @SubscribeMessage('ClientToServer')
    async handleMessage(@ConnectedSocket() socket: Socket, @MessageBody() data) {
        console.log(JSON.stringify(data), "############")
        if (data == 'room') {
            this.server.to('20250806064600712609004245').emit('ServerToClient', `room join and talk test`);
        } else {
            this.server.emit('ServerToClient', data+"123456")
        }
        //const chatUserId = Number(socket.handshake.query.id);
        //const { nickName } = await this.user.findUserByIdOrWhere(chatUserId);
        //socket.broadcast.to(roomName).emit('msgToReciver', { nickName, message });
    }

    // @SubscribeMessage('create-room')
    // async handleCreateRoom(
    //     @ConnectedSocket() socket: Socket, 
    //     @MessageBody() roomName: string,
    // ) {
    //     const chatUserId = Number(socket.handshake.query.id);
    //     const invitedUserId = Number(socket.handshake.query.inviteId)
        
        
    //     try {
        
    //     const { nickName } = await this.user.findUserByIdOrWhere(chatUserId);
    //     const { nickName: invitedUserNickname } = await this.user.findUserByIdOrWhere(invitedUserId);  
        
    //     const {roomInfo} = await this.socketRepository.detailRoomInfo({accountId: chatUserId, invitedUserId: invitedUserId})
        
    //     if (roomInfo) {
    //         throw new HttpException(exceptionMessagesSocket.THIS_ROOM_ALREADY_EXISTS, 400)
    //     }

    //     await this.socketRepository.createRoomWithUsers({
    //         roomName,
    //         accountId: chatUserId,
    //         invitedUserId
    //     })
        
    //     socket.join(roomName)
    //     this.server.emit('createRoom', `${nickName}님이 ${invitedUserNickname}을 초대하였습니다`);
    //     this.logger.debug(`${nickName} create ${roomName} room`);
    //     } catch(err){
    //     throw new HttpException(err.message, 400)
    //     }
    // }

    @SubscribeMessage('join-room')
    async handleJoinRoom(@ConnectedSocket() socket: Socket, @MessageBody() roomId: string) {
        // const chatUserId = Number(socket.handshake.query.id);
        // try{
        //     const exRoom = await this.socketRepository.chatRoomWithAccount({
        //         roomName,
        //         accountId: chatUserId
        //     })
        
        //     if(!exRoom){
        //         throw new HttpException(exceptionMessagesSocket.THIS_ROOM_DOES_NOT_EXISTS, 400)
        //     }
        // }catch(err){
        //     throw new HttpException(err.message, 400)
        // }
        await socket.join(roomId)
        console.log('joinRoom~~~~' + roomId)
        this.server.to(roomId).emit('joinRoom', `$${roomId}에 입장..`);
    }

    @SubscribeMessage('leave-room')
    async leaveRoom(roomId: string, @ConnectedSocket() socket: Socket) {
        try {
            // const chatUserId = Number(socket.handshake.query.id);            
            // const { nickName } = await this.user.findUserByIdOrWhere(chatUserId);
            // const { roomInfo } = await this.socketRepository.chatRoomWithAccount({
            //     roomName,
            //     accountId: chatUserId
            // })
            // if(!roomInfo){
            //     throw new HttpException(exceptionMessagesSocket.THIS_ROOM_DOES_NOT_EXISTS, 400)
            // }
            await socket.leave(roomId)
            // this.socketRepository.disconnectSocketWithRoom({
            //     roomId: roomInfo.id,
            //     accountId: chatUserId
            // })        
            this.server.to(roomId).emit('leaveRoomMessage', `${roomId}에서 퇴장하셨습니다`)
        }catch(err){
            //throw new HttpException(err.message, 400)
        }
    }

    handleDisconnect(socket: Socket) {
        console.log(`Client disconnected: ${socket.id}`)
    }

}