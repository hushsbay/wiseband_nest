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
        const detailInfo = hush.addDetailInfo(kind, 'user/kind') //수정 필요함
        try {
            if (!userid || !kind) return hush.setResJson(resJson, hush.Msg.BLANK_DATA + detailInfo, hush.Code.BLANK_DATA, this.req)
            // const data = await this.menuRepo.createQueryBuilder('menu')
            // .select('COUNT(*) as CNT') //나중에 parseInt(CNT) 필요
            // .where('menu.KIND = :kind and menu.INUSE = :inuse', {
            //     kind: kind, 
            //     inuse: 'Y'
            // }).getRawOne()
            // if (!data) return hush.setResJson(resJson, hush.Msg.NOT_FOUND + detailInfo, hush.Code.NOT_FOUND, this.req)
            // const list = await this.menuperRepo.createQueryBuilder('menuper')
            // //.select(['menu.ID', 'menu.NM', 'menu.SEQ', 'menu.IMG', 'menuper.USER_ID']) //addSelect로 분리 또는 여기 'menuper.USER_ID' 하나라도 추가해야 list.length가 0 안나옴
            // //.leftJoin("menuper.menu", 'menu', 'menuper.ID = menu.ID') 
            // .leftJoinAndSelect('menuper.menu', 'menu') //보안상 특정 필드는 내리지 않거나 용량 이슈가 있는 경우를 제외하면 편리하게 사용 가능
            // .where('menuper.USER_ID = :user_id and menuper.KIND = :kind and menu.INUSE = :inuse', {
            //     user_id: userid, 
            //     kind: kind, 
            //     inuse: 'Y'
            // }).orderBy('menu.SEQ', 'ASC').getMany()
            // if (!list) return hush.setResJson(resJson, hush.Msg.NOT_FOUND + detailInfo, hush.Code.NOT_FOUND, this.req)
            // resJson.data.showMore = (list.length < parseInt(data.CNT)) ? true : false //모든 메뉴갯수보다 사용자의 메뉴갯수가 적으면 더보기 버튼이 보여야 함
                        
            const qb = await this.menuperRepo.createQueryBuilder('menuper')
            // .select(['menuper.USER_ID', 'menuper.KIND', 'menuper.ID']) 
            // .where('menuper.USER_ID = :user_id and menuper.KIND = :kind', {
            //     user_id: userid, 
            //     kind: kind
            // }).getMany()

            const list = qb
            .select(['menu.ID', 'menu.NM', 'menu.SEQ', 'menu.IMG', 'menuper.USER_ID'])
            .leftJoin(
                qb
                .subQuery()
                .select(['menuper.USER_ID', 'menuper.KIND', 'menuper.ID'])
                .from(MenuPer, 'menuper')
                .where('menuper.USER_ID = :user_id and menuper.KIND = :kind')
                .getQuery()                
                , 'menu', 'menuper.ID = menu.ID')
            .setParameter("user_id", userid)
            .setParameter("kind", kind)
            .where('menu.KIND = :kind and menu.INUSE = :inuse', {
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

/*
///////////////////////////////////////1) 위 소스는 아래 SQL과 같음
const list = await this.menuperRepo.createQueryBuilder('menuper')
//.select(['menu.ID', 'menu.NM', 'menu.SEQ', 'menu.IMG', 'menuper.USER_ID']) //addSelect로 분리 또는 여기 'menuper.USER_ID' 하나라도 추가해야 list.length가 0 안나옴
//.leftJoin("menuper.menu", 'menu', 'menuper.ID = menu.ID') 
.leftJoinAndSelect('menuper.menu', 'menu') //보안상 특정 필드는 내리지 않거나 용량 이슈가 있는 경우를 제외하면 편리하게 사용 가능
.where('menuper.USER_ID = :user_id and menuper.KIND = :kind and menu.INUSE = :inuse', {
    user_id: userid, 
    kind: kind, 
    inuse: 'Y'
}).orderBy('menu.SEQ', 'ASC').getMany() 
=>
SELECT B.USER_ID, A.ID, A.NM, A.SEQ, A.IMG
  FROM jay.s_menu_tbl A
  LEFT OUTER JOIN jay.s_menuper_tbl B ON A.KIND = B.KIND AND A.ID = B.ID
 WHERE B.USER_ID = 'oldclock'
   AND B.KIND = 'side' 
   AND A.INUSE = 'Y'
 ORDER BY A.SEQ
///////////////////////////////////////2) 위 소스는 아래 SQL과 같음
const data = await this.menuRepo.createQueryBuilder('menu')
.select('COUNT(*) as CNT') //나중에 parseInt(CNT) 필요
.where('menu.KIND = :kind and menu.INUSE = :inuse', {
    kind: kind, 
    inuse: 'Y'
}).getRawOne()
=>
SELECT count(*)
  FROM jay.s_menu_tbl
 WHERE KIND = 'side' 
   AND INUSE = 'Y'
*/