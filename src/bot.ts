import { Bot, Context, GrammyError, InlineKeyboard } from "grammy";
import { GAME_LIST, GAME_START_BUTTON_TEXT, WELCOME_MESSAGE } from "./constants";
import { getSessionId, throwIfSessionExpired, buildUrl } from "./server/utils";
import { SessionExpiredError } from "./server/errors";
import { ParseModeFlavor, hydrateReply } from "@grammyjs/parse-mode";

if (!process.env.BOT_API_KEY) {
	console.error("environment misconfigured");
}

if (process.env.BOT_API_KEY == null) throw Error("Telegram bot API token is missing.");
export const bot = new Bot<ParseModeFlavor<Context>>(process.env.BOT_API_KEY!);

bot.use(hydrateReply);

// const startingInlineKeyboard = new InlineKeyboard().game(GAME_START_BUTTON_TEXT);
let startingInlineKeyboard = new InlineKeyboard().webApp("Open Game", `${process.env.BIT_FARM_URL}`);

bot.command(
	"start",
	async (ctx) => await ctx.replyFmt(WELCOME_MESSAGE, { link_preview_options: { is_disabled: true } }),
);

// 监听 /start 命令
bot.command("start", async (ctx) => {
	await ctx.replyWithPhoto(
		`${process.env.DESCRIPTION_PICTURE}`, // 替换为你的图片 URL
		{
			caption: WELCOME_MESSAGE,
			reply_markup: new InlineKeyboard().text("Play💰", "play").row(),
		},
	);
});

let finalUrl = "";

bot.command("game", async (ctx) => {
	const chat = {
		chat_type: ctx.chat.type,
		chat_instance: ctx.chat.id.toString(),
	};

	let finalUrl = buildUrl(`${process.env.BIT_FARM_URL}`, chat);
	startingInlineKeyboard = new InlineKeyboard().webApp("Open Game", finalUrl);
	// await ctx.replyWithGame(process.env.BIT_FARM_SHORTNAME as string, {
	// 	reply_markup: startingInlineKeyboard,
	// });
	// await ctx.api.sendGame(ctx.chat.id, process.env.BIT_FARM_SHORTNAME as string, {
	// 	reply_markup: startingInlineKeyboard,
	// });
	ctx.reply("Click the button below to play the game:", {
		reply_markup: startingInlineKeyboard,
	});
});

bot.on("callback_query:game_short_name", async (ctx) => {
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
			const sessionId = getSessionId(messageId.toString(), chatId.toString());
			throwIfSessionExpired(sessionId);
			const url = finalUrl;
			// let url = await orgGameUrl(ctx);
			// const url = `${process.env.SERVER_URL}/join-game/${chatId}/${messageId}/${ctx.callbackQuery.from.id}/${ctx.callbackQuery.from.first_name}`;
			await ctx.answerCallbackQuery({ url });
		}
		if (ctx.callbackQuery.inline_message_id) {
			const inlineId = ctx.callbackQuery.inline_message_id;
			const sessionId = getSessionId(inlineId.toString());
			throwIfSessionExpired(sessionId);
			const url = finalUrl;
			// let url = await orgGameUrl(ctx);
			// const url = `${process.env.SERVER_URL}/join-game/${inlineId}/${ctx.callbackQuery.from.id}/${ctx.callbackQuery.from.first_name}`;
			await ctx.answerCallbackQuery({ url });
		} else {
			await ctx.answerCallbackQuery({
				text: `This game has gone missing... Try starting a new one!.`,
				show_alert: true,
			});
		}
	} catch (err) {
		if (err instanceof SessionExpiredError) {
			return await ctx.answerCallbackQuery({
				text: "This game has expired. Try starting a new one!",
				show_alert: true,
			});
		}

		console.error(err);

		ctx.answerCallbackQuery({
			text: `Something went wrong...`,
		}).catch((err: GrammyError) => {
			console.error(err);
		});
	}
});

async function orgGameUrl(ctx: any) {
	const user = ctx.callbackQuery.from;

	let urlWithPhoto = "";

	// 调用 getUserProfilePhotos 获取头像信息
	const profilePhotos = await ctx.api.getUserProfilePhotos(user.id, { limit: 1 });

	if (profilePhotos.total_count > 0 && profilePhotos.photos[0].length > 0) {
		// 获取用户头像的文件 ID（最高清的版本）
		const fileId = profilePhotos.photos[0][0].file_id;

		// 通过 Telegram API 获取文件下载链接
		const fileLink = await ctx.api.getFile(fileId);
		const photoUrl = `https://api.telegram.org/file/bot${process.env.BOT_API_KEY}/${fileLink.file_path}`;

		// 将头像 URL 添加到游戏链接或显示给用户
		urlWithPhoto = `${process.env.BIT_FARM_URL}?id=${user.id}&username=${
			user.username
		}&photo_url=${encodeURIComponent(photoUrl)}`;
	}

	return urlWithPhoto;
}

// 设置自定义菜单按钮
bot.api.setChatMenuButton({
	menu_button: {
		type: "web_app",
		text: "💰✋",
		web_app: {
			url: finalUrl,
		},
	},
});

// Use the default callback handler to just display its text data.
// So far, it just displays the score of the player whose button was clicked.
bot.on("callback_query:data", (ctx) => {
	ctx.answerCallbackQuery({
		text: ctx.callbackQuery.data,
		cache_time: 24 * 60 * 60, // 1 day
	});
});

bot.on("inline_query", (ctx) => {
	const query = ctx.inlineQuery.query;
	ctx.answerInlineQuery(
		searchGames(query).map((shortName, idx) => {
			return {
				type: "game",
				id: idx.toString(),
				game_short_name: shortName,
				reply_markup: startingInlineKeyboard,
			};
		}),
	).catch(console.error);
});

export function sendMsg(msg: string, chatId: string, replyMsgId?: number): void {
	bot.api.sendMessage(chatId, msg, { reply_to_message_id: replyMsgId });
}

function searchGames(query?: string) {
	if (!query) {
		return GAME_LIST.map((game) => game.shortName);
	} else {
		return GAME_LIST.filter((game) => game.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map(
			(game) => game.shortName,
		);
	}
}

export default function startBotPolling() {
	if (process.env.USE_WEBHOOK !== "True") {
		bot.start();
		console.log("Bot started polling-mode");
	}
}
