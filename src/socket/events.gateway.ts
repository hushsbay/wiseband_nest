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
                socket.on('error', (err) => { //클라이언트에서 socket.emit(undefined, data)로 수신했을 때 invalid payload 오류 발생한 적 있음
                    console.error(userid, socket.id, 'Socket error: ', err.message)
                    if (err.message === 'Unauthorized') { //테스트 코딩
                        socket.disconnect()
                    }
                })
            } catch (err) {
                console.log(userid, socket.id, err.toString())
                socket.emit('error', userid + '/' + socket.id + '/' + err.toString())
            }
        })
    }

    @SubscribeMessage('room')
    async handleMessage(@ConnectedSocket() socket: Socket, @MessageBody() data: any) { 
        //console.log(JSON.stringify(data), '##room')
        this.server.to(data.roomid).emit('room', data)
    }

    @SubscribeMessage('myself') //해당 소켓에만 전송 (1:1)
    async handleMessage0(@ConnectedSocket() socket: Socket, @MessageBody() data: any) { 
        //console.log(JSON.stringify(data), '@@myself')
        if (data.ev == 'chkAlive') {
            const sockets = await this.server.fetchSockets()
            const sockUserids = sockets.map(sock => sock['user'].userid)
            //console.log(JSON.stringify(sockUserids), '##sockUserids')
            let userids = []
            if (sockUserids.length > 0) userids = data.userids.filter((memid: string) => sockUserids.includes(memid))
            data.userids = userids
        }
        socket.emit('myself', data)
    }

    @SubscribeMessage('all')
    async handleMessage2(@ConnectedSocket() socket: Socket, @MessageBody() data: any) { 
        //console.log(JSON.stringify(data), '##all')
        this.server.emit('all', data)
    }  
    
    @SubscribeMessage('user') //namespace내 해당 유저가 가진 또 다른 소켓에도 전송 (1:N)
    async handleMessage3(@ConnectedSocket() socket: Socket, @MessageBody() data: any) { //해당 namespace내 해당 user만 골라 개별적으로 소켓 전송
        console.log(JSON.stringify(data), '##user')
        const sockets = await this.server.fetchSockets()
        for (let sock of sockets) {
            if (sock['user'].userid == data.userid) {
                sock.emit('user', data)
            }
        }
    }

    ////////////일단 아래 2개 필요해 보여서 만들어 두었으나 아직 사용할 일 없음 

    @SubscribeMessage('member') //해당 사용자에 대해 room내 전송만 필요한 경우 : 필요해 보여서 만들어 두었으나 아직 사용할 일 없음 
    async handleMessage1(@ConnectedSocket() socket: Socket, @MessageBody() data: any) { //해당 room내 해당 member만 골라 개별적으로 소켓 전송
        //console.log(JSON.stringify(data), '##member')
        const sockets = await this.server.in(data.roomid).fetchSockets()
        for (let sock of sockets) {
            //console.log(sock['user'].userid, data.memberid, '##member')
            if (sock['user'].userid == data.memberid) {
                sock.emit('member', data)
            }
        }
    }

    handleDisconnect(socket: Socket) {
        console.log(`Client disconnected: ${socket.id} ${socket['user'].userid}`)
    }

}