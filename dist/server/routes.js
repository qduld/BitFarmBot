"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const grammy_1 = require("grammy");
const http_errors_1 = __importDefault(require("http-errors"));
const bot_1 = require("../bot");
const constants_1 = require("../constants");
const server_1 = require("./server");
const utils_1 = require("./utils");
exports.default = (fastify, opts, done) => {
    fastify.get("/join-game/:inlineId/:userId/:userName", async (req, reply) => {
        const { inlineId, userId, userName } = req.params;
        if (!userId) {
            fastify.log.error(`Invalid URL params, userId: ${userId}.`);
            reply.send(http_errors_1.default.BadRequest);
            return;
        }
        const sessionId = (0, utils_1.getSessionId)(inlineId);
        const chatInfo = { inlineId };
        await (0, utils_1.handleJoinSession)(sessionId, chatInfo, userId, userName, reply);
    });
    fastify.get("/join-game/:chatId/:messageId/:userId/:userName", async (req, reply) => {
        const { chatId, messageId, userId, userName } = req.params;
        if (!userId) {
            fastify.log.error(`Invalid URL params, userId: ${userId}.`);
            reply.send(http_errors_1.default.BadRequest);
            return;
        }
        const sessionId = (0, utils_1.getSessionId)(messageId, chatId);
        const chatInfo = { chatId, messageId };
        await (0, utils_1.handleJoinSession)(sessionId, chatInfo, userId, userName, reply);
    });
    fastify.patch("/start-game/:sessionId/:userId", async (req, reply) => {
        const { sessionId, userId } = req.params;
        const success = (0, utils_1.handlePlayerStart)(sessionId, userId);
        reply.status(success ? 200 : 500).send();
    });
    fastify.post("/result/:sessionId/:userId", {
        schema: {
            params: {
                type: "object",
                properties: {
                    sessionId: { type: "string" },
                    userId: { type: "number" },
                },
            },
            body: {
                type: "object",
                properties: {
                    partial: { type: "boolean" },
                    score: { type: "number" },
                    words: { type: "array", items: { type: "string" } },
                },
            },
        },
    }, (req, reply) => {
        const { sessionId, userId } = req.params;
        if (!sessionId || !userId) {
            fastify.log.error(`Invalid URL params, sessionId: ${sessionId}, userId: ${userId}.`);
            return;
        }
        const gameSession = server_1.gameSessions[sessionId];
        const body = req.body;
        const score = body.score;
        if (!gameSession) {
            fastify.log.error(`Session with ID ${sessionId} does not exist.`);
            return reply.status(500).send();
        }
        if (!gameSession.players[userId]) {
            fastify.log.error(`User ${userId} did not join this game.`);
            return reply.status(500).send();
        }
        const player = gameSession.players[userId];
        if (player.done) {
            fastify.log.error(`User ${userId} already submitted a final score of ${player}.`);
            return reply.status(500).send();
        }
        if (score < 0) {
            fastify.log.error(`Score of ${score} is less than 0.`);
            return reply.status(500).send();
        }
        player.score = score;
        if (!body.partial) {
            handleNewScore(gameSession, userId, score).catch(console.error);
            player.done = true;
        }
        updateInlineKeyboard(gameSession);
        // perform game-specific actions here
        // this includes turn-increment logic
        switch (gameSession.game) {
            case constants_1.Game.BIT_FARM:
                player.words = body.words;
                break;
        }
        if (gameSession.turnCount == constants_1.TURN_MAX[gameSession.game]) {
            (0, utils_1.endSession)(sessionId);
        }
        reply.status(200).send();
    });
    done();
};
function updateInlineKeyboard(gameSession) {
    const inlineKeyboard = new grammy_1.InlineKeyboard().game(constants_1.GAME_START_BUTTON_TEXT).row();
    Object.values(gameSession.players)
        // sort in descending score order
        .sort((b, a) => {
        if ((!a.done && !b.done) || (!a.score && !b.score)) {
            return 0;
        }
        else if (!b.done || !b.score) {
            return 1;
        }
        else if (!a.done || !a.score) {
            return -1;
        }
        else {
            return a.score - b.score;
        }
    })
        // only show top 8, everyone else needs to train harder
        .slice(0, 8)
        .forEach((player, idx) => {
        let inlineText = `${player.done ? idx + 1 : ".."}. ${player.name}`;
        if (idx === 0 && Object.values(gameSession.players).filter((p) => p.done).length >= 2) {
            inlineText += " 🏆";
        }
        inlineKeyboard.text(inlineText, player.score ? player.score.toString() : "waiting...");
        if (idx % 2 == 1)
            inlineKeyboard.row();
    });
    function handleEditErr(err) {
        if (err.description.includes("exactly the same")) {
            server_1.fastify.log.debug("inline button unchanged");
        }
        else {
            server_1.fastify.log.error(err);
        }
    }
    if (gameSession.inlineId) {
        bot_1.bot.api
            .editMessageReplyMarkupInline(gameSession.inlineId, { reply_markup: inlineKeyboard })
            .catch(handleEditErr);
    }
    else if (gameSession.chatId && gameSession.messageId) {
        bot_1.bot.api
            .editMessageReplyMarkup(gameSession.chatId, parseInt(gameSession.messageId), {
            reply_markup: inlineKeyboard,
        })
            .catch(handleEditErr);
    }
    else {
        server_1.fastify.log.error(`updateInlineKeyboard: game session doesn't have an associated message`);
    }
}
async function handleNewScore(gameSession, scoringPlayerId, newScore) {
    const botApi = new grammy_1.Api(process.env.BOT_API_KEY);
    const oldScoredPlayers = Object.entries(gameSession.players)
        .filter((scoredPlayer) => scoredPlayer[1].done)
        .map((scoredPlayer) => {
        return {
            id: scoredPlayer[0],
            score: scoredPlayer[1].score,
        };
    });
    if (oldScoredPlayers.length < 1) {
        server_1.fastify.log.info("Not enough scored players to determine winner");
        return;
    }
    // handle this edge-case up front to make the rest of the logic work
    if (oldScoredPlayers.length == 1 && oldScoredPlayers[0].score >= newScore) {
        server_1.fastify.log.info(`First scoring player ${oldScoredPlayers[0].id} won`);
        gameSession.winnerIds = [oldScoredPlayers[0].id];
        await (0, utils_1.incrementGameScore)(gameSession, botApi, oldScoredPlayers[0].id);
    }
    const oldHighScore = Math.max(...oldScoredPlayers.map((scoredPlayer) => scoredPlayer.score));
    if (newScore == oldHighScore) {
        server_1.fastify.log.info(`Player ${scoringPlayerId} tied with [${gameSession.winnerIds}]`);
        gameSession.winnerIds.push(scoringPlayerId);
        await (0, utils_1.incrementGameScore)(gameSession, botApi, scoringPlayerId);
    }
    else if (newScore > oldHighScore) {
        server_1.fastify.log.info(`Player ${scoringPlayerId} beat old score of ${oldHighScore} with ${newScore}`);
        for (const oldWinnerId of gameSession.winnerIds) {
            await (0, utils_1.decrementGameScore)(gameSession, botApi, oldWinnerId);
        }
        gameSession.winnerIds = [scoringPlayerId];
        await (0, utils_1.incrementGameScore)(gameSession, botApi, scoringPlayerId);
    }
}
