"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const server_1 = require("../server");
const http_errors_1 = __importDefault(require("http-errors"));
exports.default = (fastify, opts, done) => {
    fastify.get("/board/:sessionId", (req, reply) => {
        const { sessionId } = req.params;
        const rhetBoard = server_1.gameSessions[sessionId].board;
        if (!rhetBoard) {
            reply.send(http_errors_1.default.InternalServerError);
            return;
        }
        reply.send(rhetBoard);
    });
    fastify.get("/session/:sessionId", (req, reply) => {
        const { sessionId } = req.params;
        const session = server_1.gameSessions[sessionId];
        if (!session) {
            reply.send(http_errors_1.default.NotFound);
            return;
        }
        const sessionView = {
            board: session.board,
            scoredUsers: session.players,
            done: session.done,
        };
        reply.send(sessionView);
    });
    done();
};
