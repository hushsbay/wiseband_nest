import { Inject, Injectable, Scope } from '@nestjs/common'
import { REQUEST } from '@nestjs/core'
import { Request } from 'express'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import * as hush from 'src/common/common'
import { ResJson } from 'src/common/resjson'
import { Code, Dealer } from 'src/code/code.entity'


@Injectable({ scope: Scope.REQUEST })
export class CodeService {
    
    constructor(
        @InjectRepository(Code) private codeRepo: Repository<Code>, 
        @InjectRepository(Dealer) private dealerRepo: Repository<Dealer>, 
        @Inject(REQUEST) private readonly req: Request
    ) {}

    async qryCode(dto: Record<string, any>): Promise<any> {
        const resJson = new ResJson()
        const kind = dto.kind
        const detailInfo = hush.addDetailInfo(kind, 'kind')
        try {
            const list = await this.codeRepo.find({ where: { KIND: kind }, order: { ID: 'ASC' }})
            if (!list) return hush.setResJson(resJson, hush.Msg.NOT_FOUND + detailInfo, hush.Code.NOT_FOUND, this.req)
            resJson.list = list
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req)
        }            
    }

    async qryDealer(dto: Record<string, any>): Promise<any> {
        try {
            const resJson = new ResJson()
            const ern = dto.ern
            const list = await this.dealerRepo.createQueryBuilder('B')
            .select(['B.ERN', 'B.DEAL_CO_NM', 'B.RPST_NM'])
            .where("ERN LIKE :ern ", { 
                ern: `${ern}%`
            })
            .orderBy('B.DEAL_CO_NM', 'ASC').getMany()
            resJson.list = list
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req)
        }
    }

    async qryDealerWithPage(dto: Record<string, any>): Promise<any> {
        try { //InfiniteQuery=EndlessScroll에도 동일하게 사용 가능함 (with useInfiniteQuery - tanstack react query)
            const resJson = new ResJson()
            const { perPage, curPage } = dto
            const qb = this.dealerRepo.createQueryBuilder('B')
            const data = await qb
            .select("COUNT(*) CNT").getRawOne()
            hush.setPageInfo(perPage, curPage, data.CNT, resJson)
            const list = await qb
            .select(['B.ERN', 'B.DEAL_CO_NM', 'B.RPST_NM'])
            .orderBy('B.DEAL_CO_NM', 'ASC').offset(resJson.offsetPos).limit(perPage).getMany()
            resJson.list = list
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req)
        }
    }

    async qryDealerDetail(dto: Record<string, any>): Promise<any> {
        try {
            const resJson = new ResJson()
            const ern = dto.ern
            const data = await this.dealerRepo.createQueryBuilder('B')
            .select(['B.ERN', 'B.DEAL_CO_NM', 'B.RPST_NM']) //'B.TAX_TYP', 
            .where("ERN = :ern ", { 
                ern: ern
            })
            .getOne()
            resJson.data = data //console.log(ern, JSON.stringify(data))
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req)
        }
    }

    async updateDealer(dto: Record<string, any>): Promise<any> {
        try {            
            const resJson = new ResJson()
            const { ern, dealernm, personnm } = dto
            console.log(ern, dealernm, personnm)
            const qb = this.dealerRepo.createQueryBuilder('B')
            await qb
            .update()
            .set({ DEAL_CO_NM: dealernm, RPST_NM: personnm })
            .where("ERN = :ern ", {
                ern: ern
            }).execute()
            //return await this.qryDealerDetail({ern}) //굳이 줄 필요없었음 tanstack query의 setQueryData() 관련임
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req)
        }
    }

}
