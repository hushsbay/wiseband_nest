import { Inject, Injectable, Scope } from '@nestjs/common'
import { REQUEST } from '@nestjs/core'
import { Request } from 'express'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import * as hush from 'src/common/common'
import { ResJson } from 'src/common/resjson'
import { MsgMst, MsgSub, MsgDtl, ChanMst, ChanDtl, GrMst, GrDtl } from 'src/chanmsg/chanmsg.entity'

@Injectable({ scope: Scope.REQUEST })
export class ChanmsgService {
    
    constructor(
        @InjectRepository(MsgMst) private msgmstRepo: Repository<MsgMst>, 
        @InjectRepository(MsgSub) private msgsubRepo: Repository<MsgSub>, 
        @InjectRepository(MsgDtl) private msgdtlRepo: Repository<MsgDtl>, 
        @InjectRepository(ChanMst) private chanmstRepo: Repository<ChanMst>, 
        @InjectRepository(ChanDtl) private chandtlRepo: Repository<ChanDtl>, 
        @InjectRepository(GrMst) private grmstRepo: Repository<GrMst>, 
        @InjectRepository(GrDtl) private grdtlRepo: Repository<GrDtl>, 
        @Inject(REQUEST) private readonly req: Request
    ) {}

    async qry(dto: Record<string, any>): Promise<any> {
        let data = { gr : null, chanmst : null, chandtl : null, msg : null }
        const resJson = new ResJson()
        const userid = this.req['user'].userid
        const grid = dto.grid
        const chanid = dto.chanid //console.log(grid, chanid, userid)
        const warnMsg = hush.addWarnMsg([grid, chanid], 'grid/chanid')
        try {
            if (!grid || !chanid) return hush.setResJson(resJson, hush.Msg.BLANK_DATA + warnMsg, hush.Code.BLANK_DATA, this.req)
            const list_gr = await this.grmstRepo.createQueryBuilder('A') //.innerJoinAndSelect('A.dtl', 'B') //모든 필드 가져오기 (아래 2행 대신)
            .select(['A.GR_NM']) //(1) .select(['A.GR_NM', 'A.MEMCNT', 'A.RMKS'])
            .innerJoin('A.dtl', 'B', 'A.GR_ID = B.GR_ID') 
            .where("A.GR_ID = :grid and A.INUSE = 'Y' and B.USERID = :userid", { grid: grid, userid: userid }).getOne() //권한 체크 포함
            if (!list_gr) return hush.setResJson(resJson, hush.Msg.NOT_FOUND + warnMsg, hush.Code.NOT_FOUND, this.req) //1) 진짜 없는 경우 2) 사용자가 없어 권한이 없는 경우 혼재
            data.gr = list_gr
            const list_chanmst = await this.chanmstRepo.createQueryBuilder('A')
            .select(['A.CHANNM', 'A.MASTERNM', 'A.STATE', 'A.MEMCNT'])
            .where("A.CHANID = :chanid and A.INUSE = 'Y' and A.TYP = 'WS'", { chanid: chanid }).getOne()
            if (!list_chanmst) return hush.setResJson(resJson, hush.Msg.NOT_FOUND + hush.addWarnMsg(chanid, 'chanid'), hush.Code.NOT_FOUND, this.req)
            data.chanmst = list_chanmst
            const list_chandtl = await this.chandtlRepo.createQueryBuilder('A')
            .select(['A.USERID', 'A.USERNM', 'A.STATE', 'A.KIND'])
            .where("A.CHANID = :chanid", { chanid: chanid })
            .orderBy('A.USERNM', 'ASC').getMany()
            if (!list_chandtl) return hush.setResJson(resJson, hush.Msg.NOT_FOUND + hush.addWarnMsg(chanid, 'chanid(dtl)'), hush.Code.NOT_FOUND, this.req)

            

            data.chandtl = list_chandtl
            resJson.data = data
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req)
        }
    }
}

/*
(1)은 아래 RAW SQL과 동일 : 아래 SQL말고 다른 SQL은 JOIN보다 테이블별로 QUERY 분리해서 짜는 것이 효율적임
SELECT A.GR_NM
  FROM JAY.S_GRMST_TBL A 
 INNER JOIN JAY.S_GRDTL_TBL B ON A.GR_ID = B.GR_ID
 WHERE A.GR_ID = '20250120084532918913033423' AND A.INUSE = 'Y' AND B.USERID = 'oldclock'
*/