/**
 * Terminal-based mini-games for AIRIS CLI.
 *
 * Games included:
 * - Snake: Move the snake to eat food and grow without hitting walls or yourself
 * - Guess: Number guessing game (higher/lower)
 * - Memory: Match pairs of cards by remembering positions
 *
 * These games are purely optional entertainment and never interfere with
 * existing commands or functionality.
 */

import { createInterface } from "node:readline";
import chalk from "chalk";
import { isNoColor } from "./visual-effects.ts";

// ============================================================================
// Helpers
// ============================================================================

function clearScreen(): void {
	process.stdout.write("\x1b[2J\x1b[H");
}

function readKey(prompt: string): Promise<string> {
	return new Promise((resolve) => {
		const rl = createInterface({
			input: process.stdin,
			output: process.stdout,
			terminal: true,
		});
		rl.question(prompt, (answer) => {
			rl.close();
			resolve(answer.trim().toLowerCase());
		});
	});
}

function readNumber(prompt: string, min: number, max: number): Promise<number> {
	return new Promise((resolve) => {
		const ask = () => {
			const rl = createInterface({
				input: process.stdin,
				output: process.stdout,
			});
			rl.question(prompt, (answer) => {
				rl.close();
				const num = parseInt(answer.trim(), 10);
				if (!Number.isNaN(num) && num >= min && num <= max) {
					resolve(num);
				} else {
					console.log(chalk.yellow(`Enter a number between ${min} and ${max}.`));
					ask();
				}
			});
		};
		ask();
	});
}

// ============================================================================
// Snake Game
// ============================================================================

interface SnakeGameOptions {
	width?: number;
	height?: number;
}

interface Position {
	x: number;
	y: number;
}

type Direction = "up" | "down" | "left" | "right";

const SNAKE_HEAD = chalk.green("\u2588");
const SNAKE_BODY = chalk.green("\u2592");
const SNAKE_FOOD = chalk.red("\u2588");
const SNAKE_WALL = chalk.dim("\u2591");
const SNAKE_EMPTY = " ";

/**
 * Play a terminal-based Snake game.
 * The player controls a snake using WASD keys to eat food and grow.
 */
export async function playSnake(options?: SnakeGameOptions): Promise<void> {
	const width = Math.min(options?.width ?? 20, 40);
	const height = Math.min(options?.height ?? 10, 20);

	const gameOver = chalk.red("\u2716");
	const title = chalk.bold.cyan("SNAKE");
	const scoreText = chalk.dim("Score:");
	const instructions = chalk.dim("WASD to move | Q to quit");

	const snake: Position[] = [{ x: Math.floor(width / 2), y: Math.floor(height / 2) }];
	let direction: Direction = "right";
	let nextDirection: Direction = "right";
	let food: Position = { x: 0, y: 0 };
	let score = 0;
	let running = true;

	// Raw terminal mode
	const stdin = process.stdin;
	const wasRaw = stdin.isRaw;
	stdin.setRawMode?.(true);
	stdin.resume();
	stdin.setEncoding("utf-8");

	// Spawn food
	const spawnFood = () => {
		let pos: Position;
		do {
			pos = {
				x: Math.floor(Math.random() * (width - 2)) + 1,
				y: Math.floor(Math.random() * (height - 2)) + 1,
			};
		} while (snake.some((s) => s.x === pos.x && s.y === pos.y));
		food = pos;
	};
	spawnFood();

	// Input handler
	const onData = (key: string) => {
		switch (key) {
			case "w":
			case "\u001B[A":
				if (direction !== "down") nextDirection = "up";
				break;
			case "s":
			case "\u001B[B":
				if (direction !== "up") nextDirection = "down";
				break;
			case "a":
			case "\u001B[D":
				if (direction !== "right") nextDirection = "left";
				break;
			case "d":
			case "\u001B[C":
				if (direction !== "left") nextDirection = "right";
				break;
			case "q":
			case "\u0003":
				running = false;
				break;
		}
	};
	stdin.on("data", onData);

	const render = (): string => {
		const grid: string[][] = [];
		for (let y = 0; y < height; y++) {
			grid[y] = [];
			for (let x = 0; x < width; x++) {
				if (y === 0 || y === height - 1 || x === 0 || x === width - 1) {
					grid[y][x] = SNAKE_WALL;
				} else if (x === food.x && y === food.y) {
					grid[y][x] = SNAKE_FOOD;
				} else {
					grid[y][x] = SNAKE_EMPTY;
				}
			}
		}

		// Draw snake
		for (let i = snake.length - 1; i >= 0; i--) {
			const seg = snake[i];
			if (i === 0) {
				grid[seg.y][seg.x] = SNAKE_HEAD;
			} else {
				grid[seg.y][seg.x] = SNAKE_BODY;
			}
		}

		const lines: string[] = [];
		if (!isNoColor()) {
			lines.push(`  ${title}  ${scoreText} ${chalk.green(score)}`);
		} else {
			lines.push(`  SNAKE  Score: ${score}`);
		}
		for (const row of grid) {
			lines.push(`  ${row.join("")}`);
		}
		lines.push(`  ${instructions}`);
		return lines.join("\n");
	};

	const gameLoop = async () => {
		const tick = () => {
			if (!running) return;

			direction = nextDirection;

			// Calculate new head
			const head = snake[0];
			const newHead: Position = { ...head };
			switch (direction) {
				case "up":
					newHead.y--;
					break;
				case "down":
					newHead.y++;
					break;
				case "left":
					newHead.x--;
					break;
				case "right":
					newHead.x++;
					break;
			}

			// Check wall collision
			if (newHead.x <= 0 || newHead.x >= width - 1 || newHead.y <= 0 || newHead.y >= height - 1) {
				running = false;
				return;
			}

			// Check self collision
			if (snake.some((s) => s.x === newHead.x && s.y === newHead.y)) {
				running = false;
				return;
			}

			snake.unshift(newHead);

			// Check food
			if (newHead.x === food.x && newHead.y === food.y) {
				score++;
				spawnFood();
			} else {
				snake.pop();
			}

			clearScreen();
			process.stdout.write(render());
		};

		// Initial render
		clearScreen();
		process.stdout.write(render());

		// Game loop
		while (running) {
			await new Promise((resolve) => setTimeout(resolve, 150));
			tick();
		}

		// Cleanup
		stdin.removeListener("data", onData);
		stdin.setRawMode?.(wasRaw ?? false);
		stdin.pause();

		clearScreen();
		const finalScore = isNoColor()
			? `Game Over! Score: ${score}`
			: `${gameOver} ${chalk.bold("Game Over!")} ${chalk.dim("Score:")} ${chalk.green(score)}`;
		console.log(finalScore);

		if (score > 0) {
			console.log(chalk.dim(`You grew to ${snake.length} segments!`));
		}
	};

	await gameLoop();
}

// ============================================================================
// Number Guessing Game
// ============================================================================

/**
 * Play a number guessing game.
 * The player guesses a number between 1 and 100 with hints.
 */
export async function playGuess(): Promise<void> {
	const maxNum = 100;
	const secret = Math.floor(Math.random() * maxNum) + 1;
	let attempts = 0;
	const maxAttempts = 10;

	const title = isNoColor() ? "GUESS THE NUMBER" : chalk.bold.cyan("GUESS THE NUMBER");
	const range = chalk.dim(`Guess a number between 1 and ${maxNum}`);
	const hintHigh = chalk.yellow("\u25BC");
	const hintLow = chalk.cyan("\u25B2");
	const win = chalk.green("\u2714");

	console.log("\n");
	console.log(`  ${title}`);
	if (!isNoColor()) {
		console.log(`  ${chalk.dim("\u2500".repeat(40))}`);
	}
	console.log(`  ${range}`);
	console.log(`  ${chalk.dim(`You have ${maxAttempts} attempts`)}`);
	console.log("");

	while (attempts < maxAttempts) {
		const remaining = maxAttempts - attempts;

		const guess = await readNumber(
			isNoColor()
				? `  Attempt ${attempts + 1}/${maxAttempts}: `
				: `  ${chalk.dim(`Attempt ${attempts + 1}/${maxAttempts}:`)} `,
			1,
			maxNum,
		);
		attempts++;

		if (guess === secret) {
			console.log(
				isNoColor()
					? `  Correct! You guessed it in ${attempts} attempts!`
					: `\n  ${win} ${chalk.bold.green("Correct!")} ${chalk.dim(`You found it in ${attempts} attempts!`)}`,
			);
			return;
		}

		if (guess < secret) {
			console.log(
				isNoColor()
					? `  Too low! (${remaining} attempts left)`
					: `  ${hintLow} ${chalk.dim("Too low!")} ${chalk.dim(`(${remaining} left)`)}`,
			);
		} else {
			console.log(
				isNoColor()
					? `  Too high! (${remaining} attempts left)`
					: `  ${hintHigh} ${chalk.dim("Too high!")} ${chalk.dim(`(${remaining} left)`)}`,
			);
		}
	}

	const fail = isNoColor()
		? `Out of attempts! The number was ${secret}`
		: `${chalk.red("\u2717")} ${chalk.bold.red("Out of attempts!")} ${chalk.dim(`The number was ${chalk.cyan(secret)}`)}`;
	console.log(`\n  ${fail}`);
}

// ============================================================================
// Memory Game
// ============================================================================

/**
 * Play a memory/matching game.
 * The player sees a grid of face-down cards and flips two at a time to find matches.
 */
export async function playMemory(): Promise<void> {
	const gridSize = 4; // 4x4 = 16 cards, 8 pairs
	const totalCards = gridSize * gridSize;

	if (totalCards % 2 !== 0) {
		console.log(chalk.red("Grid size must result in even number of cards."));
		return;
	}

	const cardValues: string[] = [];
	const pairs = totalCards / 2;
	const symbols = ["A", "B", "C", "D", "E", "F", "G", "H"];

	for (let i = 0; i < pairs; i++) {
		cardValues.push(symbols[i % symbols.length]);
		cardValues.push(symbols[i % symbols.length]);
	}

	// Shuffle
	for (let i = cardValues.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[cardValues[i], cardValues[j]] = [cardValues[j], cardValues[i]];
	}

	const revealed: boolean[] = new Array(totalCards).fill(false);
	const matched: boolean[] = new Array(totalCards).fill(false);
	let attempts = 0;
	let matches = 0;

	const title = isNoColor() ? "MEMORY GAME" : chalk.bold.cyan("MEMORY GAME");
	const matchesText = isNoColor() ? "Matches:" : chalk.dim("Matches:");
	const attemptsText = isNoColor() ? "Attempts:" : chalk.dim("Attempts:");
	const back = isNoColor() ? "?" : chalk.dim("\u25A0");

	const renderBoard = (): string => {
		const lines: string[] = [];
		lines.push("");
		if (!isNoColor()) {
			lines.push(
				`  ${title}     ${matchesText} ${chalk.green(matches)}/${pairs}  ${attemptsText} ${chalk.cyan(attempts)}`,
			);
			lines.push(`  ${chalk.dim("\u2500".repeat(35))}`);
		} else {
			lines.push(`  ${title}     Matches: ${matches}/${pairs}  Attempts: ${attempts}`);
		}

		for (let y = 0; y < gridSize; y++) {
			const row: string[] = [];
			for (let x = 0; x < gridSize; x++) {
				const idx = y * gridSize + x;
				if (matched[idx]) {
					row.push(chalk.green(cardValues[idx]));
				} else if (revealed[idx]) {
					row.push(chalk.cyan(cardValues[idx]));
				} else {
					row.push(back);
				}
			}
			lines.push(`  ${row.join(" ")}`);
		}

		const instr = isNoColor() ? "Pick two cards (1-16):" : chalk.dim("Pick two cards (1-16) or 0 to quit:");
		lines.push(`  ${instr}`);
		return lines.join("\n");
	};

	console.log(renderBoard());

	while (matches < pairs) {
		const card1 = await readNumber(isNoColor() ? "  First card: " : `  ${chalk.dim("First card:")} `, 0, totalCards);
		if (card1 === 0) {
			console.log(chalk.dim("Game cancelled."));
			return;
		}
		const idx1 = card1 - 1;

		if (matched[idx1]) {
			console.log(chalk.yellow("  That card is already matched!"));
			continue;
		}
		if (revealed[idx1]) {
			console.log(chalk.yellow("  That card is already revealed!"));
			continue;
		}

		revealed[idx1] = true;
		clearScreen();
		console.log(renderBoard());

		const card2 = await readNumber(
			isNoColor() ? "  Second card: " : `  ${chalk.dim("Second card:")} `,
			0,
			totalCards,
		);
		if (card2 === 0) {
			revealed[idx1] = false;
			console.log(chalk.dim("Game cancelled."));
			return;
		}
		const idx2 = card2 - 1;

		if (idx1 === idx2) {
			console.log(chalk.yellow("  Same card! Try again."));
			revealed[idx1] = false;
			continue;
		}
		if (matched[idx2]) {
			console.log(chalk.yellow("  That card is already matched!"));
			revealed[idx1] = false;
			continue;
		}

		revealed[idx2] = true;
		attempts++;
		clearScreen();
		console.log(renderBoard());

		if (cardValues[idx1] === cardValues[idx2]) {
			matched[idx1] = true;
			matched[idx2] = true;
			matches++;

			if (!isNoColor()) {
				console.log(`  ${chalk.green("\u2714 Match!")}`);
			} else {
				console.log("  Match!");
			}
		} else {
			if (!isNoColor()) {
				console.log(`  ${chalk.yellow("\u2716 Not a match")}`);
			} else {
				console.log("  Not a match");
			}
			await new Promise((resolve) => setTimeout(resolve, 1000));
			revealed[idx1] = false;
			revealed[idx2] = false;
			clearScreen();
			console.log(renderBoard());
		}
	}

	if (!isNoColor()) {
		console.log(`\n  ${chalk.green("\u2714")} ${chalk.bold.green("You won!")} ${chalk.dim(`${attempts} attempts`)}`);
	} else {
		console.log(`\n  You won! ${attempts} attempts`);
	}
}

// ============================================================================
// Game Command Router
// ============================================================================

const GAME_HELP = chalk.cyan(`
  ${chalk.bold("AIRIS Games")}
  ${chalk.dim("\u2500".repeat(30))}

  ${chalk.cyan("snake")}     ${chalk.dim("Classic snake game. Eat food, avoid walls. WASD to move.")}
  ${chalk.cyan("guess")}     ${chalk.dim("Number guessing game. Find the secret number.")}
  ${chalk.cyan("memory")}    ${chalk.dim("Memory matching game. Find all pairs.")}
  ${chalk.cyan("help")}      ${chalk.dim("Show this help")}

  ${chalk.dim("Example: airis game snake")}
`);

export interface GameResult {
	played: boolean;
	game?: string;
}

/**
 * Route and launch a mini-game.
 *
 * @param args - Game subcommand arguments
 * @returns Whether a game was played
 */
export async function handleGameCommand(args: string[]): Promise<GameResult> {
	const offset = args[0]?.toLowerCase() === "game" ? 1 : 0;
	const game = (args[offset] ?? "help").toLowerCase();

	switch (game) {
		case "snake": {
			if (!isNoColor()) {
				console.log(chalk.cyan("\n  Starting Snake..."));
				console.log(chalk.dim("  \u2500".repeat(20)));
			} else {
				console.log("\n  Starting Snake...");
			}
			await new Promise((resolve) => setTimeout(resolve, 500));
			await playSnake();
			return { played: true, game: "snake" };
		}

		case "guess": {
			await playGuess();
			return { played: true, game: "guess" };
		}

		case "memory": {
			await playMemory();
			return { played: true, game: "memory" };
		}

		case "help":
			console.log(GAME_HELP);
			return { played: true, game: "help" };

		default:
			return { played: false };
	}
}

// ============================================================================
// Combined game list help text
// ============================================================================

export function printGameHeader(): void {
	if (isNoColor()) {
		console.log("\nAIRIS Mini-Games");
		console.log("----------------");
		console.log("Available: snake, guess, memory, help");
		console.log("Usage: airis game <name>");
	} else {
		console.log(GAME_HELP);
	}
}
