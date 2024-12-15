import { code, fmt, link } from "@grammyjs/parse-mode";

export enum Game {
	BIT_FARM,
}

export const GAME_LIST = [
	{
		name: "Bit Farm Online",
		shortName: "BitFarm",
	},
];

export const GAME_URL: { [key in Game]: string } = {
	[Game.BIT_FARM]: process.env.BIT_FARM_URL as string,
};

export const PLAYER_MAX: { [key in Game]: number } = {
	[Game.BIT_FARM]: Number.MAX_VALUE,
};

export const TURN_MAX: { [key in Game]: number } = {
	[Game.BIT_FARM]: Number.MAX_VALUE,
};

export const GAME_START_BUTTON_TEXT = "Play now!";

export const MAX_SESSIONS = 10000;
export const NUM_DAYS_SESSION_EXPIRED = 3;

export const WELCOME_MESSAGE = `Welcome!

This bot is a game bot about TON farm named BitFarm.

Sow Now,Reap Tokens`;

// export const WELCOME_MESSAGE = fmt`Welcome!

// This bot is best used in ${link(
// 	"Inline Mode",
// 	"https://telegram.org/blog/inline-bots",
// )}. Just go to your chat then type the name of the bot with a space at the end: ${code(
// 	"@gamejaybot ",
// )} and a list of games should show up! You can search through the games by continuing to type your search query. Then, tap on the one you want to start and it will send a new game to the chat you're in.

// Currently, Word Hunt Online is the only game available for GameJay, but more are planned to be added!`;
