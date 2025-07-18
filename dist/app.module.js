"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const config_1 = require("@nestjs/config");
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const typeorm_transactional_1 = require("typeorm-transactional");
const serve_static_1 = require("@nestjs/serve-static");
const path_1 = require("path");
const app_config_1 = require("./app.config");
const http_exception_filter_1 = require("./common/http-exception.filter");
const logger_middleware_1 = require("./common/logger.middleware");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const auth_module_1 = require("./auth/auth.module");
const menu_module_1 = require("./menu/menu.module");
const user_module_1 = require("./user/user.module");
const chanmsg_module_1 = require("./chanmsg/chanmsg.module");
const mail_module_1 = require("./mail/mail.module");
let AppModule = class AppModule {
    configure(consumer) {
        consumer.apply(logger_middleware_1.LoggerMiddleware).forRoutes('*');
    }
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                load: [app_config_1.default],
                isGlobal: true
            }),
            typeorm_1.TypeOrmModule.forRootAsync({
                useFactory() {
                    const config = (0, app_config_1.default)();
                    return {
                        type: 'mysql',
                        host: config.mysql.host,
                        port: parseInt(config.mysql.port),
                        username: config.mysql.username,
                        password: config.mysql.password,
                        database: config.mysql.database,
                        autoLoadEntities: true
                    };
                },
                async dataSourceFactory(option) {
                    if (!option)
                        throw new Error('Invalid options passed');
                    return (0, typeorm_transactional_1.addTransactionalDataSource)(new typeorm_2.DataSource(option));
                },
            }),
            serve_static_1.ServeStaticModule.forRoot({
                rootPath: (0, path_1.join)(__dirname, '..', 'public')
            }),
            auth_module_1.AuthModule, user_module_1.UserModule, menu_module_1.MenuModule, chanmsg_module_1.ChanmsgModule, mail_module_1.MailModule
        ],
        controllers: [app_controller_1.AppController],
        providers: [
            {
                provide: core_1.APP_FILTER,
                useClass: http_exception_filter_1.HttpExceptionFilter
            },
            app_service_1.AppService,
            common_1.Logger
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map