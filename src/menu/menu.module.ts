import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { Menu, MenuPer } from 'src/menu/menu.entity'
import { MenuService } from 'src/menu/menu.service'
import { MenuController } from 'src/menu/menu.controller'

@Module({
    imports: [TypeOrmModule.forFeature([Menu, MenuPer])],
    controllers: [MenuController],
    providers: [MenuService]
})

export class MenuModule {}
