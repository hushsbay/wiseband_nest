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
}>;
export default _default;
