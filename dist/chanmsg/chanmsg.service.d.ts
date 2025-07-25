import { Request } from 'express';
import { Repository, DataSource, SelectQueryBuilder } from 'typeorm';
import { MailService } from 'src/mail/mail.service';
import { MsgMst, MsgSub, MsgDtl, ChanMst, ChanDtl, GrMst, GrDtl } from 'src/chanmsg/chanmsg.entity';
import { User } from 'src/user/user.entity';
export declare class ChanmsgService {
    private msgmstRepo;
    private msgsubRepo;
    private msgdtlRepo;
    private chanmstRepo;
    private chandtlRepo;
    private grmstRepo;
    private grdtlRepo;
    private userRepo;
    private dataSource;
    private mailSvc;
    private readonly req;
    constructor(msgmstRepo: Repository<MsgMst>, msgsubRepo: Repository<MsgSub>, msgdtlRepo: Repository<MsgDtl>, chanmstRepo: Repository<ChanMst>, chandtlRepo: Repository<ChanDtl>, grmstRepo: Repository<GrMst>, grdtlRepo: Repository<GrDtl>, userRepo: Repository<User>, dataSource: DataSource, mailSvc: MailService, req: Request);
    chkAcl(dto: Record<string, any>): Promise<any>;
    qryMsgDtlForUser(qb: SelectQueryBuilder<MsgDtl>, msgid: string, chanid: string, userid: string): Promise<any>;
    qryMsgDtl(qb: SelectQueryBuilder<MsgDtl>, msgid: string, chanid: string): Promise<any>;
    qryMsgDtlMention(qb: SelectQueryBuilder<MsgDtl>, msgid: string, chanid: string): Promise<any>;
    qryMsgSub(qb: SelectQueryBuilder<MsgSub>, msgid: string, chanid: string): Promise<any>;
    qryReply(qb: SelectQueryBuilder<MsgMst>, msgid: string, chanid: string): Promise<any>;
    qryReplyInfo(msgid: string, chanid: string, userid: string): Promise<any>;
    qryVipList(userid: string): Promise<any>;
    getSqlWs(userid: string): string;
    getSqlGs(userid: string): string;
    qry(dto: Record<string, any>): Promise<any>;
    qryChanMstDtl(dto: Record<string, any>): Promise<any>;
    qryOneMsgNotYet(dto: Record<string, any>): Promise<any>;
    searchMedia(dto: Record<string, any>): Promise<any>;
    searchMsg(dto: Record<string, any>): Promise<any>;
    qryMsg(dto: Record<string, any>): Promise<any>;
    qryActionForUser(dto: Record<string, any>): Promise<any>;
    qryAction(dto: Record<string, any>): Promise<any>;
    saveMsg(dto: Record<string, any>): Promise<any>;
    forwardToChan(dto: Record<string, any>): Promise<any>;
    delMsg(dto: Record<string, any>): Promise<any>;
    toggleChanOption(dto: Record<string, any>): Promise<any>;
    updateWithNewKind(dto: Record<string, any>): Promise<any>;
    updateNotyetToRead(dto: Record<string, any>): Promise<any>;
    updateAllWithNewKind(dto: Record<string, any>): Promise<any>;
    toggleReaction(dto: Record<string, any>): Promise<any>;
    changeAction(dto: Record<string, any>): Promise<any>;
    uploadBlob(dto: Record<string, any>, file: Express.Multer.File): Promise<any>;
    delBlob(dto: Record<string, any>): Promise<any>;
    readBlob(dto: Record<string, any>): Promise<any>;
    saveChan(dto: Record<string, any>): Promise<any>;
    deleteChan(dto: Record<string, any>): Promise<any>;
    saveChanMember(dto: Record<string, any>): Promise<any>;
    deleteChanMember(dto: Record<string, any>): Promise<any>;
    inviteToMember(dto: Record<string, any>): Promise<any>;
    qryDataLogEach(dto: Record<string, any>): Promise<any>;
}
