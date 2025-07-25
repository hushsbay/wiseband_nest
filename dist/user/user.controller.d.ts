import { UserService } from 'src/user/user.service';
export declare class UserController {
    private readonly userSvc;
    constructor(userSvc: UserService);
    getUserInfo(dto: Record<string, any>): Promise<any>;
    setUserInfo(dto: Record<string, any>, file: Express.Multer.File): Promise<any>;
    changePwd(dto: Record<string, any>): Promise<any>;
    orgTree(dto: Record<string, any>): Promise<any>;
    procOrgSearch(dto: Record<string, any>): Promise<any>;
    qryGroupWithUser(dto: Record<string, any>): Promise<any>;
    setVip(dto: Record<string, any>): Promise<any>;
    saveMember(dto: Record<string, any>): Promise<any>;
    deleteMember(dto: Record<string, any>): Promise<any>;
    saveGroup(dto: Record<string, any>): Promise<any>;
    deleteGroup(dto: Record<string, any>): Promise<any>;
}
