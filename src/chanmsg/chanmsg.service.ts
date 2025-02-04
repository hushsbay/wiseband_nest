import { Inject, Injectable, Scope } from '@nestjs/common'
import { REQUEST } from '@nestjs/core'
import { Request } from 'express'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import * as hush from 'src/common/common'
import { ResJson } from 'src/common/resjson'
import { MsgMst, MsgSub, MsgDtl } from 'src/chanmsg/chanmsg.entity'

// const list = await this.menuperRepo.createQueryBuilder('menuper')
// //.select(['menu.ID', 'menu.NM', 'menu.SEQ', 'menu.IMG', 'menuper.USER_ID']) //addSelect로 분리 또는 여기 'menuper.USER_ID' 하나라도 추가해야 list.length가 0 안나옴
// //.leftJoin("menuper.menu", 'menu', 'menuper.ID = menu.ID') 
// .leftJoinAndSelect('menuper.menu', 'menu') //보안상 특정 필드는 내리지 않거나 용량 이슈가 있는 경우를 제외하면 편리하게 사용 가능
// .where('menuper.USER_ID = :user_id and menuper.KIND = :kind and menu.INUSE = :inuse', {
//     user_id: userid, 
//     kind: kind, 
//     inuse: 'Y'
// }).orderBy('menu.SEQ', 'ASC').getMany() 
// =>
// SELECT B.USER_ID, A.ID, A.NM, A.SEQ, A.IMG
//   FROM jay.s_menu_tbl A
//   LEFT OUTER JOIN jay.s_menuper_tbl B ON A.KIND = B.KIND AND A.ID = B.ID
//  WHERE B.USER_ID = 'oldclock'
//    AND B.KIND = 'side' 
//    AND A.INUSE = 'Y'
//  ORDER BY A.SEQ

@Injectable({ scope: Scope.REQUEST })
export class ChanmsgService {
    
    constructor(
        @InjectRepository(MsgMst) private msgmstRepo: Repository<MsgMst>, 
        @InjectRepository(MsgSub) private msgsubRepo: Repository<MsgSub>, 
        @InjectRepository(MsgDtl) private msgdtlRepo: Repository<MsgDtl>, 
        @Inject(REQUEST) private readonly req: Request
    ) {}

    async qry(dto: Record<string, any>): Promise<any> {
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        const kind = dto.kind //console.log(userid, kind)
        const detailInfo = hush.addDetailInfo(kind, 'user/kind') //수정 필요함
        try {
            if (!userid || !kind) return hush.setResJson(resJson, hush.Msg.BLANK_DATA + detailInfo, hush.Code.BLANK_DATA, this.req)
            
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req) 
        }
    }
}

/*
(1) 아래 RAW SQL과 동일 : 아래 SQL말고는 현재 JOIN해서 짜는 것보다는 테이블별로 QUERY를 분리해서 짜는 것이 훨씬 효율적임
SELECT A.GR_NM, A.MEMCNT, A.RMKS
          FROM JAY.S_GRMST_TBL A 
         INNER JOIN JAY.S_GRDTL_TBL B ON A.GR_ID = B.GR_ID
         WHERE A.GR_ID = '20250120084532918913033423' AND A.INUSE = 'Y' AND B.USERID = 'oldclock'
*/