"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildUrl = exports.throwIfSessionExpired = exports.sortDescendingScore = exports.getSessionId = exports.endSession = exports.createSession = exports.handlePlayerStart = exports.handleJoinSession = exports.decrementGameScore = exports.incrementGameScore = exports.getGameScoreObj = exports.setGameScore = void 0;
const crypto_1 = require("crypto");
const constants_1 = require("../constants");
const server_1 = require("./server");
const date_fns_1 = require("date-fns");
const errors_1 = require("./errors");
const main_1 = __importDefault(require("./bit-farm/main"));
function setGameScore(gameSession, api, userId, score, force = false) {
    server_1.fastify.log.info(`Changing score of player ${userId} to ${score}, force=${force}`);
    if (gameSession.inlineId) {
        api.setGameScoreInline(gameSession.inlineId, parseInt(userId), score, {
            force,
        }).catch(handleScoreUpdateErr);
    }
    else if (gameSession.chatId && gameSession.messageId) {
        api.setGameScore(parseInt(gameSession.chatId), parseInt(gameSession.messageId), parseInt(userId), score, {
            force,
        }).catch(handleScoreUpdateErr);
    }
}
exports.setGameScore = setGameScore;
async function getGameScoreObj(gameSession, api, userId) {
    let gameScores;
    try {
        if (gameSession.inlineId) {
            gameScores = await api.getGameHighScoresInline(gameSession.inlineId, parseInt(userId));
        }
        else if (gameSession.chatId && gameSession.messageId) {
            gameScores = await api.getGameHighScores(parseInt(gameSession.chatId), parseInt(gameSession.messageId), parseInt(userId));
        }
    }
    catch (err) {
        server_1.fastify.log.error(err);
    }
    const foundScore = gameScores?.find((gameScore) => gameScore.user.id === parseInt(userId));
    server_1.fastify.log.debug(`Found score: ${foundScore}`);
    return foundScore;
}
exports.getGameScoreObj = getGameScoreObj;
/**
 * Handles incrementing a player's score. If the player has never
 * scored before, will set to 1.
 * @param gameSession
 * @param api Grammy bot API object
 * @param playerId
 */
async function incrementGameScore(gameSession, api, playerId) {
    const oldScoreObj = await getGameScoreObj(gameSession, api, playerId);
    setGameScore(gameSession, api, playerId, oldScoreObj ? oldScoreObj.score + 1 : 1);
}
exports.incrementGameScore = incrementGameScore;
/**
 * Handles decrementing a player's score. Will return early with a warning
 * if the player's score is not found.
 * @param gameSession
 * @param api Grammy bot API object
 * @param playerId
 */
async function decrementGameScore(gameSession, api, playerId) {
    const oldScoreObj = await getGameScoreObj(gameSession, api, playerId);
    if (!oldScoreObj) {
        server_1.fastify.log.warn(`Player ${playerId} does not have a score`);
        return;
    }
    setGameScore(gameSession, api, playerId, oldScoreObj.score - 1, true);
}
exports.decrementGameScore = decrementGameScore;
function cleanupExpiredSessions() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - constants_1.NUM_DAYS_SESSION_EXPIRED);
    // TODO: Maybe replace with sorting and binary search
    // if performance ever becomes an issue
    for (const id of Object.keys(server_1.gameSessions)) {
        if (server_1.gameSessions[id].created < cutoffDate) {
            delete server_1.gameSessions[id];
        }
    }
}
async function handleJoinSession(sessionId, chatInfo, userId, userName, res) {
    if (!server_1.gameSessions[sessionId]) {
        // TODO: Start a wordhunt game by default; will need a way to specify the game later
        const sessionCreated = await createSession(constants_1.Game.BIT_FARM, chatInfo, sessionId);
        if (!sessionCreated) {
            server_1.fastify.log.warn(`handleJoinSession: session ${sessionId} not created`);
            res.redirect("https://http.cat/images/503.jpg");
            return;
        }
    }
    const session = server_1.gameSessions[sessionId];
    // add player to session if possible
    // NOTE: this probably isn't a race condition? Node is single-threaded right?
    if (!session.players[userId] && Object.keys(session.players).length < constants_1.PLAYER_MAX[session.game]) {
        session.players[userId] = {
            words: [],
            name: userName,
            started: false,
            done: false,
        };
    }
    // determine where to redirect the browser
    if (session.players[userId] && !session.players[userId].started) {
        switch (session.game) {
            case constants_1.Game.BIT_FARM:
                res.redirect(`${constants_1.GAME_URL[constants_1.Game.BIT_FARM]}?session=${sessionId}&user=${userId}`);
                break;
        }
    }
    else {
        switch (session.game) {
            case constants_1.Game.BIT_FARM:
                res.redirect(`${constants_1.GAME_URL[constants_1.Game.BIT_FARM]}?session=${sessionId}&user=${userId}&spectate=true`);
                break;
        }
        // TODO: implement spectator mode (doesn't matter for word hunt)
    }
}
exports.handleJoinSession = handleJoinSession;
/**
 * Let's the session know that a player started. This usually means that
 * if the player leaves and comes back, they forfeit their turn.
 * @param sessionId
 * @param userId
 */
function handlePlayerStart(sessionId, userId) {
    if (!server_1.gameSessions[sessionId]) {
        server_1.fastify.log.error("handlePlayerStart: Session not found");
        return false;
    }
    if (!server_1.gameSessions[sessionId].players[userId]) {
        server_1.fastify.log.error("handlePlayerStart: User not found in session");
        return false;
    }
    server_1.gameSessions[sessionId].players[userId].started = true;
    return true;
}
exports.handlePlayerStart = handlePlayerStart;
/**
 * As a side-effect, cleans up expired sesisons
 *
 * @param game The game to create a session of
 * @param uid The ID to be used for the session
 * @returns The ID used for the session
 */
async function createSession(game, chatInfo, sessionId) {
    cleanupExpiredSessions();
    if (Object.keys(server_1.gameSessions).length > constants_1.MAX_SESSIONS) {
        server_1.fastify.log.warn(`createSession: max number of sessions (${constants_1.MAX_SESSIONS}) reached`);
        return false;
    }
    server_1.gameSessions[sessionId] = {
        chatId: chatInfo.chatId,
        messageId: chatInfo.messageId,
        inlineId: chatInfo.inlineId,
        game,
        turnCount: 0,
        players: {},
        winnerIds: [],
        done: false,
        created: new Date(),
    };
    switch (game) {
        case constants_1.Game.BIT_FARM:
            server_1.gameSessions[sessionId].board = await main_1.default.getBoardWithSolutions();
            break;
    }
    return true;
}
exports.createSession = createSession;
function endSession(sessionId) {
    const gameSession = server_1.gameSessions[sessionId];
    // TODO: maybe report the winner to telegram
    // TODO: Save session to database so we don't have to keep it in memory...
    gameSession.done = true;
    console.log(`Game ${sessionId} over. Saving to database...`);
    // I want this ^ so ppl can go to their games and see things like the scores and potential words (in word hunt)
}
exports.endSession = endSession;
function getSessionId(messageId, chatId = "pingas") {
    const hash = (0, crypto_1.createHash)("sha1");
    hash.update(chatId);
    hash.update(messageId);
    return hash.digest().toString("base64url");
}
exports.getSessionId = getSessionId;
function handleScoreUpdateErr(err) {
    if (err.description.includes("BOT_SCORE_NOT_MODIFIED")) {
        server_1.fastify.log.warn("Score not modified");
    }
    else {
        server_1.fastify.log.error(err);
    }
}
function sortDescendingScore(a, b) {
    return (b.score ?? Number.MIN_SAFE_INTEGER) - (a.score ?? Number.MIN_SAFE_INTEGER);
}
exports.sortDescendingScore = sortDescendingScore;
function throwIfSessionExpired(sessionId) {
    if (server_1.gameSessions[sessionId] &&
        (0, date_fns_1.differenceInDays)(new Date(), server_1.gameSessions[sessionId].created) >= constants_1.NUM_DAYS_SESSION_EXPIRED) {
        throw new errors_1.SessionExpiredError(sessionId);
    }
}
exports.throwIfSessionExpired = throwIfSessionExpired;
/**
 * 将对象参数绑定到指定的 URL 上，生成带查询参数的 URL。
 * @param baseUrl 基础 URL（不包含查询参数）
 * @param params 需要绑定到 URL 的对象参数
 * @returns 带查询参数的完整 URL
 */
function buildUrl(baseUrl, params) {
    const url = new URL(baseUrl);
    // 遍历对象并添加非 undefined 和非 null 的参数到 URL 上
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
            url.searchParams.append(key, String(value));
        }
    });
    return url.toString();
}
exports.buildUrl = buildUrl;
