"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResJson = void 0;
class ResJson {
    constructor(code = '0', msg = '', offsetPos = undefined, totalCnt = undefined, totalPage = undefined, data = {}, list = []) {
        this.code = code;
        this.msg = msg;
        this.offsetPos = offsetPos;
        this.totalCnt = totalCnt;
        this.totalPage = totalPage;
        this.data = data;
        this.list = list;
    }
}
exports.ResJson = ResJson;
//# sourceMappingURL=resjson.js.map