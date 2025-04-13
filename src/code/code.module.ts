import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { Code, Dealer } from 'src/code/code.entity'
import { CodeService } from 'src/code/code.service'
import { CodeController } from 'src/code/code.controller'

@Module({
    imports: [TypeOrmModule.forFeature([Code, Dealer])],
    controllers: [CodeController],
    providers: [CodeService]
})

export class CodeModule {}
