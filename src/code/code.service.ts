import { Inject, Injectable, Scope } from '@nestjs/common'
import { REQUEST } from '@nestjs/core'
import { Request } from 'express'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import * as hush from 'src/common/common'
import { ResJson } from 'src/common/resjson'
import { Code } from 'src/code/code.entity'

@Injectable({ scope: Scope.REQUEST })
export class CodeService {
    
    constructor(@InjectRepository(Code) private codeRepo: Repository<Code>, @Inject(REQUEST) private readonly req: Request) {}

    async qry(dto: Record<string, any>): Promise<any> {
        const resJson = new ResJson()
        const kind = dto.kind
        const detailInfo = hush.addDetailInfo(kind, 'kind')
        try {
            if (!kind) return hush.setResJson(resJson, hush.Msg.BLANK_DATA + detailInfo, hush.Code.BLANK_DATA, this.req)
            const list = await this.codeRepo.find({ where: { KIND: kind }, order: { ID: 'ASC' }})
            if (!list) return hush.setResJson(resJson, hush.Msg.NOT_FOUND + detailInfo, hush.Code.NOT_FOUND, this.req)
            resJson.list = list
            return resJson
        } catch (ex) {
            hush.throwCatchedEx(ex, this.req)
        }            
    }

}
