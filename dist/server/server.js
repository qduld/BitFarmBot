"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.gameSessions = exports.fastify = void 0;
require("dotenv/config");
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const fastify_disablecache_1 = __importDefault(require("fastify-disablecache"));
const swagger_1 = __importDefault(require("@fastify/swagger"));
const swagger_ui_1 = __importDefault(require("@fastify/swagger-ui"));
const routes_1 = __importDefault(require("./bit-farm/routes"));
const routes_2 = __importDefault(require("./routes"));
const main_1 = __importDefault(require("./bit-farm/main"));
const bot_1 = __importStar(require("../bot"));
const grammy_1 = require("grammy");
exports.fastify = (0, fastify_1.default)({
    logger: { level: process.env.LOG_LEVEL ?? "debug" },
});
const validDomains = process.env.CORS_ACCESS.split(",");
exports.fastify.register(cors_1.default, {
    origin: validDomains.length > 1 ? validDomains : validDomains[0],
});
exports.fastify.register(fastify_disablecache_1.default);
exports.fastify.register(swagger_1.default, {
    swagger: {
        info: {
            title: "GameJay API",
            description: "Internal API for GameJay server.",
            version: "0.0.1",
        },
        externalDocs: {
            url: "https://swagger.io",
            description: "Find more info here",
        },
        host: "localhost:3000",
        schemes: ["http"],
        consumes: ["application/json"],
        produces: ["application/json"],
    },
});
exports.fastify.register(swagger_ui_1.default, {
    routePrefix: "/docs",
    uiConfig: {
        docExpansion: "list",
        deepLinking: true,
    },
    uiHooks: {
        onRequest: function (request, reply, next) {
            next();
        },
        preHandler: function (request, reply, next) {
            next();
        },
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
    transformSpecification: (swaggerObject, request, reply) => {
        return swaggerObject;
    },
    transformSpecificationClone: true,
});
exports.fastify.register(routes_2.default);
exports.fastify.register(routes_1.default, { prefix: "/bitFarm" });
if (process.env.USE_WEBHOOK === "True") {
    exports.fastify.post(`/${process.env.WEBHOOK_SECRET}`, {
        onError: (req, res, err) => {
            console.error("Error with webhookCallback!");
            if (err.message.includes("Cannot read properties of undefined (reading 'update_id')")) {
                exports.fastify.log.warn("update_id was missing in webhook callback... consider if this is a problem");
            }
            else {
                throw err;
            }
        },
    }, (0, grammy_1.webhookCallback)(bot_1.bot, "fastify"));
}
exports.fastify.setErrorHandler((err, req, reply) => {
    exports.fastify.log.error(err);
    reply.status(500).send();
});
async function startServer() {
    await main_1.default.init();
    exports.fastify.listen({
        host: process.env.SERVER_DOMAIN ?? "0.0.0.0",
        port: parseInt(process.env.PORT ?? "3000"),
    }, async (err) => {
        if (err) {
            exports.fastify.log.fatal(err);
            process.exit(1);
        }
        // await fastify.oas();
        if (process.env.USE_WEBHOOK === "True") {
            await bot_1.bot.api.setWebhook(`${process.env.SERVER_URL}/${process.env.WEBHOOK_SECRET}`);
            console.log("Bot webhook set");
        }
    });
}
// start server loop
startServer();
// start bot polling mode, if enabled
(0, bot_1.default)();
exports.gameSessions = {};
