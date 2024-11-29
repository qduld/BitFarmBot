"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WELCOME_MESSAGE = exports.NUM_DAYS_SESSION_EXPIRED = exports.MAX_SESSIONS = exports.GAME_START_BUTTON_TEXT = exports.TURN_MAX = exports.PLAYER_MAX = exports.GAME_URL = exports.GAME_LIST = exports.Game = void 0;
const parse_mode_1 = require("@grammyjs/parse-mode");
var Game;
(function (Game) {
    Game[Game["BIT_FARM"] = 0] = "BIT_FARM";
})(Game || (exports.Game = Game = {}));
exports.GAME_LIST = [
    {
        name: "Bit Farm Online",
        shortName: "BitFarm",
    },
];
exports.GAME_URL = {
    [Game.BIT_FARM]: process.env.BIT_FARM_URL,
};
exports.PLAYER_MAX = {
    [Game.BIT_FARM]: Number.MAX_VALUE,
};
exports.TURN_MAX = {
    [Game.BIT_FARM]: Number.MAX_VALUE,
};
exports.GAME_START_BUTTON_TEXT = "Play now!";
exports.MAX_SESSIONS = 10000;
exports.NUM_DAYS_SESSION_EXPIRED = 3;
exports.WELCOME_MESSAGE = (0, parse_mode_1.fmt) `Welcome!

This bot is best used in ${(0, parse_mode_1.link)("Inline Mode", "https://telegram.org/blog/inline-bots")}. Just go to your chat then type the name of the bot with a space at the end: ${(0, parse_mode_1.code)("@gamejaybot ")} and a list of games should show up! You can search through the games by continuing to type your search query. Then, tap on the one you want to start and it will send a new game to the chat you're in.

Currently, Word Hunt Online is the only game available for GameJay, but more are planned to be added!`;
