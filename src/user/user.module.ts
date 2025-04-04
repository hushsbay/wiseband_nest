import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { User } from 'src/user/user.entity'
import { UserService } from 'src/user/user.service'
import { UserController } from 'src/user/user.controller'

@Module({
    imports: [TypeOrmModule.forFeature([User])],
    controllers: [UserController],
    providers: [UserService],
    exports: [UserService]
})

export class UserModule {}
