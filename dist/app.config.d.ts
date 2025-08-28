declare const _default: (() => {
    mysql: {
        host: string;
        port: string;
        username: string;
        password: string;
        database: string;
    };
    crypto: {
        key: string;
    };
    jwt: {
        key: string;
    };
    sock: {
        port: string;
    };
    redis: {
        host: string;
        port: string;
        password: string;
    };
}) & import("@nestjs/config").ConfigFactoryKeyHost<{
    mysql: {
        host: string;
        port: string;
        username: string;
        password: string;
        database: string;
    };
    crypto: {
        key: string;
    };
    jwt: {
        key: string;
    };
    sock: {
        port: string;
    };
    redis: {
        host: string;
        port: string;
        password: string;
    };
}>;
export default _default;
