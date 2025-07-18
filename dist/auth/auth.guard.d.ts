import { CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
export declare class AuthGuard implements CanActivate {
    private jwtSvc;
    private reflector;
    private logger;
    constructor(jwtSvc: JwtService, reflector: Reflector, logger: Logger);
    canActivate(context: ExecutionContext): Promise<boolean>;
    private extractToken;
}
