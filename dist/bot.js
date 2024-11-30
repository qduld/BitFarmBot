"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendMsg = exports.bot = void 0;
const grammy_1 = require("grammy");
const constants_1 = require("./constants");
const utils_1 = require("./server/utils");
const errors_1 = require("./server/errors");
const parse_mode_1 = require("@grammyjs/parse-mode");
if (!process.env.BOT_API_KEY) {
    console.error("environment misconfigured");
}
if (process.env.BOT_API_KEY == null)
    throw Error("Telegram bot API token is missing.");
exports.bot = new grammy_1.Bot(process.env.BOT_API_KEY);
exports.bot.use(parse_mode_1.hydrateReply);
const startingInlineKeyboard = new grammy_1.InlineKeyboard().game(constants_1.GAME_START_BUTTON_TEXT);
// const startingInlineKeyboard = new InlineKeyboard().webApp("Open Game", `${process.env.BIT_FARM_URL}`);
exports.bot.command("start", async (ctx) => await ctx.replyFmt(constants_1.WELCOME_MESSAGE, { link_preview_options: { is_disabled: true } }));
exports.bot.command("game", async (ctx) => {
    await ctx.replyWithGame(process.env.BIT_FARM_SHORTNAME, {
        reply_markup: startingInlineKeyboard,
    });
    // await ctx.api.sendGame(ctx.chat.id, process.env.BIT_FARM_SHORTNAME as string, {
    // 	reply_markup: startingInlineKeyboard,
    // });
    // ctx.reply("Click the button below to play the game:", {
    // 	reply_markup: startingInlineKeyboard,
    // });
});
exports.bot.on("callback_query:game_short_name", async (ctx) => {
    if (ctx.callbackQuery.from.is_bot) {
        // Silly bot, games are for users!
        return;
    }
    console.log("User starting a game...");
    console.log(ctx.callbackQuery.from);
    try {
        if (ctx.callbackQuery.message) {
            const chatId = ctx.callbackQuery.message.chat.id;
            const messageId = ctx.callbackQuery.message.message_id;
            const sessionId = (0, utils_1.getSessionId)(messageId.toString(), chatId.toString());
            (0, utils_1.throwIfSessionExpired)(sessionId);
            const url = `${process.env.BIT_FARM_URL}`;
            // const url = `${process.env.SERVER_URL}/join-game/${chatId}/${messageId}/${ctx.callbackQuery.from.id}/${ctx.callbackQuery.from.first_name}`;
            await ctx.answerCallbackQuery({ url });
        }
        if (ctx.callbackQuery.inline_message_id) {
            const inlineId = ctx.callbackQuery.inline_message_id;
            const sessionId = (0, utils_1.getSessionId)(inlineId.toString());
            (0, utils_1.throwIfSessionExpired)(sessionId);
            const url = `${process.env.BIT_FARM_URL}`;
            // const url = `${process.env.SERVER_URL}/join-game/${inlineId}/${ctx.callbackQuery.from.id}/${ctx.callbackQuery.from.first_name}`;
            await ctx.answerCallbackQuery({ url });
        }
        else {
            await ctx.answerCallbackQuery({
                text: `This game has gone missing... Try starting a new one!.`,
                show_alert: true,
            });
        }
    }
    catch (err) {
        if (err instanceof errors_1.SessionExpiredError) {
            return await ctx.answerCallbackQuery({
                text: "This game has expired. Try starting a new one!",
                show_alert: true,
            });
        }
        console.error(err);
        ctx.answerCallbackQuery({
            text: `Something went wrong...`,
        }).catch((err) => {
            console.error(err);
        });
    }
});
// Use the default callback handler to just display its text data.
// So far, it just displays the score of the player whose button was clicked.
exports.bot.on("callback_query:data", (ctx) => {
    ctx.answerCallbackQuery({
        text: ctx.callbackQuery.data,
        cache_time: 24 * 60 * 60, // 1 day
    });
});
exports.bot.on("inline_query", (ctx) => {
    const query = ctx.inlineQuery.query;
    ctx.answerInlineQuery(searchGames(query).map((shortName, idx) => {
        return {
            type: "game",
            id: idx.toString(),
            game_short_name: shortName,
            reply_markup: startingInlineKeyboard,
        };
    })).catch(console.error);
});
function sendMsg(msg, chatId, replyMsgId) {
    exports.bot.api.sendMessage(chatId, msg, { reply_to_message_id: replyMsgId });
}
exports.sendMsg = sendMsg;
function searchGames(query) {
    if (!query) {
        return constants_1.GAME_LIST.map((game) => game.shortName);
    }
    else {
        return constants_1.GAME_LIST.filter((game) => game.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map((game) => game.shortName);
    }
}
function startBotPolling() {
    if (process.env.USE_WEBHOOK !== "True") {
        exports.bot.start();
        console.log("Bot started polling-mode");
    }
}
exports.default = startBotPolling;
