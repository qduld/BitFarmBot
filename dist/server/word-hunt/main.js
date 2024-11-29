"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pf_boggle_1 = __importDefault(require("pf-boggle"));
const DEBUG = false;
const GRID_SIZE = 4;
const MIN_WORDS = 30;
const NUM_BOARDS = 10;
const boards = [];
async function init() {
    await genBoards();
    if (DEBUG) {
        // eslint-disable-next-line no-console
        console.log(boards);
    }
}
async function getBoardWithSolutions() {
    let rhetBoard = boards.pop();
    if (!rhetBoard) {
        console.warn("Ran out of boards! Generating a new one...");
        rhetBoard = genBoard();
    }
    // fill up board slots async
    // NOTE: Node is single threaded so this probably won't result in a race condition?
    genBoards();
    return rhetBoard;
}
function genBoards() {
    // TODO: Maybe implement a timeout error
    while (boards.length < NUM_BOARDS) {
        boards.push(genBoard());
    }
}
function genBoard() {
    let boardWords = new Set();
    let board = [];
    while (boardWords.size < MIN_WORDS) {
        if (DEBUG) {
            console.log(`generating new board ${board.length + 1}...`);
        }
        board = pf_boggle_1.default.generate(GRID_SIZE).map((letter) => letter.slice(0, 1)); // I guess boggle considers QU a letter...
        const solutions = pf_boggle_1.default.solve(board);
        boardWords = new Set(solutions.map((solution) => solution.word).filter((word) => word.length > 2));
    }
    return {
        board,
        words: Array.from(boardWords),
    };
}
exports.default = {
    init,
    getBoardWithSolutions,
};
