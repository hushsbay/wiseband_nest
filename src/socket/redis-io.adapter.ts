import { IoAdapter } from '@nestjs/platform-socket.io'
import { ServerOptions } from 'socket.io'
import { createAdapter } from '@socket.io/redis-adapter'
import { createClient } from 'redis'
import appConfig from 'src/app.config' //import { ConfigService } from '@nestjs/config'

export class RedisIoAdapter extends IoAdapter {

    private adapterConstructor: ReturnType<typeof createAdapter>

    async connectToRedis(): Promise<void> {
        const config = appConfig()
        const pubClient = createClient({ //const pubClient = createClient({ url: `redis://localhost:6379` })
            socket: { host: config.redis.host, port: parseInt(config.redis.port) }, password: config.redis.password 
        })
        const subClient = pubClient.duplicate()
        await Promise.all([pubClient.connect(), subClient.connect()])
        this.adapterConstructor = createAdapter(pubClient, subClient)
    }

    createIOServer(port: number, options?: ServerOptions): any {
        const server = super.createIOServer(port, options)
        server.adapter(this.adapterConstructor)
        return server
    }

}

//how to add socket. id into redis adapter on nest.js => googling + https://socket.io/docs/v4/redis-adapter/
//How socket.id is handled:
//When a client connects, socket.io assigns a unique socket.id. When the Redis adapter is in use, this socket.id is used internally by the adapter to:
//Manage Rooms and Broadcasting:
//When you join a room or emit to a specific socket.id, the Redis adapter leverages Redis's Pub/Sub mechanism to broadcast messages to the correct instances and clients across your cluster.
//Track Sockets across Instances:
//The adapter maintains information about which socket.id is connected to which server instance, allowing for seamless communication even when clients are connected to different nodes in a horizontally scaled environment.
//You do not explicitly "add" socket.id to the Redis adapter; rather, the adapter utilizes the socket.id as part of its internal mechanism for distributed WebSocket communication. 
//You interact with socket.id through the standard socket.io API (e.g., socket.id, io.to(socketId).emit(...)).