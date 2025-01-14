import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { Menu } from 'src/menu/menu.entity'
import { MenuService } from 'src/menu/menu.service'
import { MenuController } from 'src/menu/menu.controller'

@Module({
    imports: [TypeOrmModule.forFeature([Menu])],
    controllers: [MenuController],
    providers: [MenuService]
})

export class MenuModule {}
