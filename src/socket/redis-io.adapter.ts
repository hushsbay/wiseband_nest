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