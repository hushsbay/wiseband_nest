import { AuthService } from 'src/auth/auth.service';
export declare class AuthController {
    private authSvc;
    constructor(authSvc: AuthService);
    login(dto: Record<string, any>): Promise<import("../common/resjson").ResJson>;
    setOtp(dto: Record<string, any>): Promise<import("../common/resjson").ResJson>;
    verifyOtp(dto: Record<string, any>): Promise<import("../common/resjson").ResJson>;
}
