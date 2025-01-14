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
        const kind = dto.kind //console.log(userid, kind)
        const detailInfo = hush.addDetailInfo(kind, 'user/kind')
        try {
            if (!userid || !kind) return hush.setResJson(resJson, hush.Msg.BLANK_DATA + detailInfo, hush.Code.BLANK_DATA, this.req)
            const list = await this.menuperRepo.createQueryBuilder('menuper')
            //.select(['menu.ID', 'menu.NM', 'menu.SEQ', 'menu.IMG', 'menuper.USER_ID']) //addSelect로 분리 또는 여기 'menuper.USER_ID' 하나라도 추가해야 list.length가 0 안나옴
            //.leftJoin("menuper.menu", 'menu', 'menuper.ID = menu.ID') 
            .leftJoinAndSelect("menuper.menu", 'menu') //보안상 특정 필드는 내리지 않거나 용량 이슈가 있는 경우를 제외하면 편리하게 사용 가능
            .where('menuper.USER_ID = :user_id and menuper.KIND = :kind and menu.INUSE = :inuse', {
                user_id: userid, 
                kind: kind, 
                inuse: 'Y'
            }).orderBy('menu.SEQ', 'ASC').getMany()
            if (!list) return hush.setResJson(resJson, hush.Msg.NOT_FOUND + detailInfo, hush.Code.NOT_FOUND, this.req)
            resJson.list = list
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req) 
        }
    }

}
