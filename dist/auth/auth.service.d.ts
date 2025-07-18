import { Request } from 'express';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { ResJson } from 'src/common/resjson';
import { UserService } from 'src/user/user.service';
import { MailService } from 'src/mail/mail.service';
export declare class AuthService {
    private userSvc;
    private jwtSvc;
    private mailSvc;
    private dataSource;
    private readonly req;
    constructor(userSvc: UserService, jwtSvc: JwtService, mailSvc: MailService, dataSource: DataSource, req: Request);
    setUserDataWithToken(userDataObj: any): Promise<any>;
    login(dto: Record<string, any>): Promise<ResJson>;
    setOtp(dto: Record<string, any>): Promise<ResJson>;
    verifyOtp(dto: Record<string, any>): Promise<ResJson>;
    qryUserList(dto: Record<string, any>): Promise<any>;
}
