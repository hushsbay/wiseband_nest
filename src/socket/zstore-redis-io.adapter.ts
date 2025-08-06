// import { IoAdapter } from '@nestjs/platform-socket.io';
// import { ServerOptions } from 'socket.io';
// import { createAdapter } from '@socket.io/redis-adapter';
// import { createClient } from 'redis';
// import { INestApplication } from '@nestjs/common';

// export class RedisIoAdapter extends IoAdapter {

//     private redisAdapter;

//     constructor(app: INestApplication) {
//         super(app)
//         const pubClient = createClient({ url: `redis://localhost:6379` })
//         const subClient = pubClient.duplicate()
//         pubClient.connect()
//         subClient.connect()
//         this.redisAdapter = createAdapter(pubClient, subClient)
//     }

//     createIOServer(port: number, options?: ServerOptions): any {
//         const server = super.createIOServer(port, options)
//         server.adapter(this.redisAdapter)
//         return server
//     }
    
// }