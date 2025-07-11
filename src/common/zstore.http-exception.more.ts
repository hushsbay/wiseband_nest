// import { HttpException, HttpStatus } from '@nestjs/common';

// export enum MoreCode {
//     JwtExpired = 8001
// }

// export interface IBaseException {
//     code: number;
//     msg: string;
//   }

// export class HttpMoreException extends HttpException implements IBaseException {
//     code: number;
//     msg: string;
//     constructor(code: number, msg: string, statusCode: number) {
//         super(msg, statusCode);
//         this.code = code;
//         this.msg = msg;
//     }
// }

// export class JwtExpiredException extends HttpMoreException {
//     constructor() {
//         super(MoreCode.JwtExpired, 'JwtExpired', HttpStatus.UNAUTHORIZED);
//     }
// }
