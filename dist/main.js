"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const typeorm_transactional_1 = require("typeorm-transactional");
const cookieParser = require("cookie-parser");
const app_module_1 = require("./app.module");
const winston_util_1 = require("./common/winston.util");
async function bootstrap() {
    const corsList = ['http://127.0.0.1:5173', 'http://localhost:5173', 'http://10.10.221.214:5173'];
    (0, typeorm_transactional_1.initializeTransactionalContext)();
    const app = await core_1.NestFactory.create(app_module_1.AppModule, {
        logger: winston_util_1.winstonLogger,
        bufferLogs: true
    });
    app.enableCors({ origin: corsList, credentials: true });
    app.use(cookieParser());
    await app.listen(process.env.NODE_PORT);
}
bootstrap();
//# sourceMappingURL=main.js.map