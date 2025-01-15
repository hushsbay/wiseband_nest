import { Inject, Injectable, Scope } from '@nestjs/common'
import { REQUEST } from '@nestjs/core'
import { Request } from 'express'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, Repository } from 'typeorm'

import * as hush from 'src/common/common'
import { ResJson } from 'src/common/resjson'
import { Menu, MenuPer } from 'src/menu/menu.entity'

@Injectable({ scope: Scope.REQUEST })
export class MenuService {
    
    constructor(
        @InjectRepository(Menu) private menuRepo: Repository<Menu>, 
        @InjectRepository(MenuPer) private menuperRepo: Repository<MenuPer>, 
        private dataSource : DataSource,
        @Inject(REQUEST) private readonly req: Request
    ) {}

    async qry(dto: Record<string, any>): Promise<any> {
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        const kind = dto.kind //console.log(userid, kind)
        const detailInfo = hush.addDetailInfo(kind, 'user/kind') //수정 필요함
        try {
            if (!userid || !kind) return hush.setResJson(resJson, hush.Msg.BLANK_DATA + detailInfo, hush.Code.BLANK_DATA, this.req)
            //여기서는 아래 sql처럼 menu중에 특정user가 설정하지 않은 menu도 포함해서 조회해서 내려주면 
            //클라이언트가 아래 B.USER_ID가 null인 것을 제외하면 그 사용자가 가진 menu목록이 되고 null은 더보기 버튼을 눌러 보게 되는 것을
            //맨 아래 주석의 '1),2) 위 소스는 아래 SQL과 같음'과 같이 두번을 호출하지 않고 한번의 query로 가져오려 했으나
            //typeorm으로 leftjoin내의 subquery 구현을 제대로 해내지 못해 결국 포기하고 일단 아래 raw sql로 얻고자 함
            let sql = "SELECT A.ID, A.NM, A.SEQ, A.IMG, B.USER_ID "
            sql += "     FROM s_menu_tbl A "
            sql += "     LEFT OUTER JOIN (SELECT USER_ID, KIND, ID FROM s_menuper_tbl WHERE USER_ID = ? AND KIND = ?) B "
            sql += "       ON A.KIND = B.KIND AND A.ID = B.ID "
            sql += "    WHERE A.KIND = ? "
            sql += "      AND A.INUSE = ? "
            sql += "    ORDER BY A.SEQ "
            const list = await this.dataSource.query(sql, [userid, 'side', 'side', 'Y'])
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