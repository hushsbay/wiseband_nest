import { Request } from 'express';
import { DataSource } from 'typeorm';
export declare class MenuService {
    private dataSource;
    private readonly req;
    constructor(dataSource: DataSource, req: Request);
    qryMembersWithPic(chanid: string, userid: string, pictureCount: number): Promise<any>;
    qryKindCntForUser(chanid: string, userid: string, kind: string): Promise<number>;
    qry(dto: Record<string, any>): Promise<any>;
    qryChan(dto: Record<string, any>): Promise<any>;
    qryKindCnt(dto: Record<string, any>): Promise<any>;
    qryDm(dto: Record<string, any>): Promise<any>;
    qryDmChkExist(dto: Record<string, any>): Promise<any>;
    qryPanel(dto: Record<string, any>): Promise<any>;
    qryPanelCount(dto: Record<string, any>): Promise<any>;
    qryActivity(dto: Record<string, any>): Promise<any>;
    qryGroup(dto: Record<string, any>): Promise<any>;
}
