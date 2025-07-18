"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Unauth = exports.IS_UNAUTH_KEY = void 0;
const common_1 = require("@nestjs/common");
exports.IS_UNAUTH_KEY = 'isUnAuth';
const Unauth = () => (0, common_1.SetMetadata)(exports.IS_UNAUTH_KEY, true);
exports.Unauth = Unauth;
//# sourceMappingURL=unauth.decorator.js.map