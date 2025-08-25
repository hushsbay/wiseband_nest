import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { DataSource } from 'typeorm'
import { Logger, Inject } from '@nestjs/common'
import { MessageBody, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer, ConnectedSocket, } from '@nestjs/websockets' //OnGatewayConnection, OnGatewayInit
import { Server, Socket } from 'socket.io'
import * as hush from 'src/common/common'

@WebSocketGateway({ port: 8080, transports: ['websocket', 'polling'], cors: { origin: ['https://hushsbay.com:446', 'http://localhost:5173'] }, namespace: hush.cons.appName, pingTimeout: 5000, pingInterval: 25000 })
export class EventsGateway implements OnGatewayDisconnect { //OnGatewayConnection

    constructor(
        @Inject(DataSource) private readonly dataSource: DataSource, //private dataSource : DataSource,
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
    ) {}

    @WebSocketServer()
    server: Server

    //private readonly logger = new Logger('EventsGateway')
    //handleConnection(socket: Socket, ...args: any[]) { socket.emit('welcome', `Hello, client ${socket.id}!`) } //OnGatewayConnection에서 필요한 메소드

    afterInit(server: Server) { //this.logger.log('WebSocket Gateway initialized')
        //server.use((socket: Socket, next) 사용시 오류 발생하면 next(new Error('Authentication failed: Invalid token.')) 방식으로 한다는데 어디로 전달되는지 파악이 안됨
        //throw new WsException('Invalid token')로 처리시 서버 죽음 : error handling with next() on socket.io nest.js로 구글링하기
        server.on('connection', async (socket) => { //console.log(`Client connected: ${socket.id}`)
            let userid = ''
            try {
                const token = socket.handshake.query.token as string
                const secret = this.configService.get<string>('JWT_KEY')
                const decoded = this.jwtService.verify(token, { secret })
                socket['user'] = decoded //console.log(JSON.stringify(decoded))              
                userid = decoded.userid
                console.log("connected:", socket.id, userid)
                let sqlBasicAcl = hush.getBasicAclSql(userid, "ALL", true) //내가 권한을 가진 채널과 DM에 대해 room join 처리 : 내가 포함안된 공개채널은 제외
                const list = await this.dataSource.query(sqlBasicAcl, null)
                for (let room of list) socket.join(room.CHANID) //1안
                //const rooms = []; for (let room of list) rooms.push(room.CHANID); const sock = server.in(socket.id); sock.socketsJoin(rooms) //2안
                socket.on('error', (err) => { //예) 클라이언트에서 socket.emit(undefined, data)로 수신했을 때 invalid payload 오류 발생한 적 있음
                    console.error(userid, socket.id, 'Socket error: ', err.message)
                    if (err.message === 'Unauthorized') socket.disconnect() //테스트 코딩
                })
            } catch (err) {
                console.log(userid, socket.id, err.toString())
                socket.emit('error', userid + '/' + socket.id + '/' + err.toString())
            }
        })
    }

    @SubscribeMessage('room')
    async handleMessage(@ConnectedSocket() socket: Socket, @MessageBody() data: any) { //console.log(JSON.stringify(data), '##room')
        this.server.to(data.roomid).emit('room', data)
    }

    @SubscribeMessage('myself') //해당 소켓에만 전송 (1:1)
    async handleMessage0(@ConnectedSocket() socket: Socket, @MessageBody() data: any) { //: Promise<any> //console.log(JSON.stringify(data), '@@myself')
        if (data.ev == 'chkAlive') {
            const sockets = await this.server.fetchSockets()
            const sockUserids = sockets.map(sock => sock['user'].userid) //console.log(JSON.stringify(sockUserids), '##sockUserids')
            let userids = []
            if (sockUserids.length > 0) userids = data.userids.filter((memid: string) => sockUserids.includes(memid))
            data.userids = userids
        } else if (data.ev == 'roomJoin') {
            const sockets = await this.server.fetchSockets()
            for (const sock of sockets) {
                if (sock['user'] && data.memberIdAdded.includes(sock['user'].userid)) {
                    sock.join(data.roomid) //memberIdAdded엔 추가할 멤버들만 들어 있음
                }
            } //this.server.to(data.roomid).emit('room', data) //myself가 아닌 room로 바로 전달하지 않고 local로 내려서 inviteMsg 처리 (in Main.vue)
        } else if (data.ev == 'roomLeave') { //퇴장 or 강제퇴장
            const sockets = await this.server.in(data.roomid).fetchSockets()
            for (const sock of sockets) {
                if (sock['user'] && data.memberIdLeft.includes(sock['user'].userid)) {
                    sock.leave(data.roomid) //memberIdLeft엔 퇴장한 멤버들만 들어 있음
                    sock.emit('myself', data) //퇴장한 소켓으로 전달해서 해당 노드 제거하라고 하기
                }
            }
        } else if (data.ev == 'qrySock') { //Admin 전용
            const curdtObj = await hush.getMysqlCurdt(this.dataSource)
            const list = []            
            if (data.kind == 'all') {
                const sockets = await this.server.fetchSockets()
                for (const sock of sockets) { //console.log(sock)
                    let row = { userid: '', usernm: '', socketid: '' }
                    if (sock['user']) {
                        row.userid = sock['user'].userid
                        row.usernm = sock['user'].usernm
                        row.socketid = sock.id
                        const arr = [...sock.rooms] //rooms(Set) into Array
                        row['rooms'] = arr
                        for (let item of arr) { //console.log(JSON.stringify(item))
                            const obj = { 
                                roomid: item, memberid: sock['user'].userid, membernm: sock['user'].usernm, 
                                socketid: sock.id, kind: data.kind, userid: socket['user'].userid, dt: curdtObj.DT
                            } //여기서 dataSource.query() 실행하면 usedQueryRunner.query is not a function 오류 발생 : 해결못해 일단 common.ts(hush)로 넘겨 처리함
                            await hush.insertIntoSockTbl(this.dataSource, obj)
                        }                        
                    } else {
                        console.log('EventsGateway: 여기로 들어오면 안됨')
                    }
                    list.push(row)
                }
            }
            data.list = list //현재는 data return해서 클라이언트에서 사용하는 것 없음 (admin이 db 열어서 조회해 사용하는 것으로 마무리함)
        }
        socket.emit('myself', data)
    }

    @SubscribeMessage('all')
    async handleMessage2(@ConnectedSocket() socket: Socket, @MessageBody() data: any) { //console.log(JSON.stringify(data), '##all')
        this.server.emit('all', data)
    }  
    
    @SubscribeMessage('user') //namespace내 해당 유저가 가진 또 다른 소켓에도 전송 (1:N)
    async handleMessage3(@ConnectedSocket() socket: Socket, @MessageBody() data: any) { //console.log(JSON.stringify(data), '##user')
        const sockets = await this.server.fetchSockets()
        for (let sock of sockets) { //해당 namespace내 해당 user만 골라 개별적으로 소켓 전송
            if (sock['user'].userid == data.userid) {
                sock.emit('user', data)
            }
        }
    }

    @SubscribeMessage('member') //해당 사용자에 대해 room내 전송만 필요한 경우 : 필요해 보여서 만들어 두었으나 아직 사용할 일 없음 
    async handleMessage1(@ConnectedSocket() socket: Socket, @MessageBody() data: any) { //console.log(JSON.stringify(data), '##member')
        const sockets = await this.server.in(data.roomid).fetchSockets()
        for (let sock of sockets) { //해당 room내 해당 member만 골라 개별적으로 소켓 전송
            if (sock['user'].userid == data.memberid) {
                sock.emit('member', data)
            }
        }
    }

    handleDisconnect(socket: Socket) {
        console.log(`disconnected: ${socket.id} ${socket['user'].userid}`)
    }

}