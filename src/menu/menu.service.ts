import { Inject, Injectable, Scope } from '@nestjs/common'
import { REQUEST } from '@nestjs/core'
import { Request } from 'express'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import * as hush from 'src/common/common'
import { ResJson } from 'src/common/resjson'
import { Menu, MenuPer } from 'src/menu/menu.entity'

@Injectable({ scope: Scope.REQUEST })
export class MenuService {
    
    constructor(
        @InjectRepository(Menu) private menuRepo: Repository<Menu>, 
        @InjectRepository(MenuPer) private menuperRepo: Repository<MenuPer>, 
        @Inject(REQUEST) private readonly req: Request
    ) {}

    async qry(dto: Record<string, any>): Promise<any> {
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        const kind = dto.kind
        console.log(userid, kind)
        const detailInfo = hush.addDetailInfo(kind, 'user/kind')
        try {
            //const fields = ['KIND', 'ID', 'NM', 'SEQ', 'INUSE', 'BASIC', 'ONCAT(BASE_ADDR, " ", DTL_ADDR) AS ADDR']

            if (!userid || !kind) return hush.setResJson(resJson, hush.Msg.BLANK_DATA + detailInfo, hush.Code.BLANK_DATA, this.req)
            const list = await this.menuRepo.find({ where: { KIND: kind }, order: { ID: 'ASC' }})



            if (!list) return hush.setResJson(resJson, hush.Msg.NOT_FOUND + detailInfo, hush.Code.NOT_FOUND, this.req)
            resJson.list = list
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req)
        }
    }

}
