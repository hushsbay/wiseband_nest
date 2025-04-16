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
            .select(['B.ERN', 'B.TAX_TYP', 'B.DEAL_CO_NM', 'B.RPST_NM'])
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

    async qryDealerDetail(dto: Record<string, any>): Promise<any> {
        try {
            const resJson = new ResJson()
            const ern = dto.ern
            const data = await this.dealerRepo.createQueryBuilder('B')
            .select(['B.ERN', 'B.TAX_TYP', 'B.DEAL_CO_NM', 'B.RPST_NM'])
            .where("ERN = :ern ", { 
                ern: ern
            })
            .getOne()
            resJson.data = data
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req)
        }
    }

}
