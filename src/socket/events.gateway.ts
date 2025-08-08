import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { DataSource } from 'typeorm'
import { Logger } from '@nestjs/common'
import { MessageBody, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer, ConnectedSocket, } from '@nestjs/websockets' //OnGatewayConnection, OnGatewayInit
import { Server, Socket } from 'socket.io'
import * as hush from 'src/common/common'

@WebSocketGateway({ 
    port: 8080, 
    transports: ['websocket', 'polling'], 
    cors: { origin: '*' }, 
    namespace: hush.cons.appName,
    pingTimeout: 5000, 
    pingInterval: 25000
})
export class EventsGateway implements OnGatewayDisconnect { //OnGatewayConnection

    constructor(
        private dataSource : DataSource,
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
    ) {}

    private readonly logger = new Logger('EventsGateway')                                        

    @WebSocketServer()
    server: Server

    //handleConnection(socket: Socket, ...args: any[]) { socket.emit('welcome', `Hello, client ${socket.id}!`) } //OnGatewayConnection에서 필요한 메소드

    afterInit(server: Server) { //this.logger.log('WebSocket Gateway initialized')
        //erver.use((socket: Socket, next) 사용시 오류 발생하면 next(new Error('Authentication failed: Invalid token.')) 방식으로 한다는데 어디로 전달되는지 파악이 안됨
        //throw new WsException('Invalid token')로 처리시 서버 죽음 : error handling with next() on socket.io nest.js로 구글링하기
        server.on('connection', async (socket) => { //console.log(`Client connected: ${socket.id}`)
            let userid = ''
            try {                
                const token = socket.handshake.query.token as string
                const secret = this.configService.get<string>('JWT_KEY')
                const decoded = this.jwtService.verify(token, { secret })
                socket['user'] = decoded //console.log(JSON.stringify(decoded), "++++++++++")
                userid = decoded.userid
                console.log("server connection:", socket.id, userid)
                let sqlBasicAcl = hush.getBasicAclSql(userid, "ALL", true) //내가 권한을 가진 채널과 DM에 대해 room join 처리 : 내가 포함안된 공개채널은 제외
                const list = await this.dataSource.query(sqlBasicAcl, null)
                const rooms = [] //1안 처리
                for (let room of list) rooms.push(room.CHANID)                
                const sock = server.in(socket.id)
                const sockets = await server.fetchSockets() //모든 소켓
                for (const socket of sockets) { //console.log(socket.id, socket.handshake, socket.rooms, socket.data, JSON.stringify(socket['user']))
                    if (socket['user'] && socket['user'].userid == userid) { //사용자:소켓 = 1:N
                        sock.socketsJoin(rooms)
                    }
                }
                // const sockets = await server.fetchSockets() //2안 처리
                // for (const socket of sockets) {
                //     if (socket['user'] && socket['user'].userid == userid) {
                //         for (let room of list) socket.join(room.CHANID)
                //     }
                // }
                socket.on('error', (err) => {
                    console.error(userid, socket, 'Socket error: ', err.message)
                    if (err.message === 'Unauthorized') { //테스트 코딩
                        socket.disconnect()
                    }
                })
            } catch (err) {
                console.log(userid, socket, err.toString())
                socket.emit('error', userid + '/' + socket + '/' + err.toString())
            }
        })
    }

    @SubscribeMessage('room')
    async handleMessage(@ConnectedSocket() socket: Socket, @MessageBody() data) { 
        console.log(JSON.stringify(data), '##room')
        this.server.to(data.roomid).emit('room', data)
    }

    // @SubscribeMessage('sendMsg')
    // async handleMessage(@ConnectedSocket() socket: Socket, @MessageBody() data) { 
    //     console.log(JSON.stringify(data), "############sendMsg")
    //     this.server.to(data.roomid).emit('sendMsg', data)
    // }

    // @SubscribeMessage('ClientToServer') //test
    // async handleMessage1(@ConnectedSocket() socket: Socket, @MessageBody() data) {
    //     console.log(JSON.stringify(data), "############")
    //     if (data == 'room') {
    //         this.server.to('20250806064600712609004245').emit('ServerToClient', `room join and talk test`);
    //     } else {
    //         this.server.emit('ServerToClient', data+"123456")
    //     }
    //     //socket.broadcast.to(roomName).emit('msgToReciver', { nickName, message });
    // }

    // @SubscribeMessage('joinRoom') //test
    // async handleJoinRoom(@ConnectedSocket() socket: Socket, @MessageBody() roomId: string) {
    //     await socket.join(roomId)
    //     //this.server.to(roomId).emit('joinRoom', `$${roomId}에 입장..`);
    // }

    // @SubscribeMessage('leaveRoom') //test
    // async leaveRoom(roomId: string, @ConnectedSocket() socket: Socket) {
    //     await socket.leave(roomId)
    //     //this.server.to(roomId).emit('leaveRoomMessage', `${roomId}에서 퇴장하셨습니다`)
    // }

    handleDisconnect(socket: Socket) {
        console.log(`Client disconnected: ${socket.id} ${socket['user'].userid}`)
    }

}