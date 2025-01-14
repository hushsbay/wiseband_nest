import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { Code } from 'src/code/code.entity'
import { CodeService } from 'src/code/code.service'
import { CodeController } from 'src/code/code.controller'

@Module({
    imports: [TypeOrmModule.forFeature([Code])],
    controllers: [CodeController],
    providers: [CodeService]
})

export class CodeModule {}
