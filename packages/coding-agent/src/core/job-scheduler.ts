/**
 * Background Job Scheduler — detached job execution, scheduling, a persistent
 * job queue, and resumption.
 *
 * Fills agent-runtime gaps: background task execution, detached long-running
 * jobs, task scheduling, job queue management, and task resumption.
 *
 * Design:
 * - Jobs are persisted to `.airis/memory/jobs.json` so the queue survives
 *   restarts and can be resumed.
 * - Execution is delegated to an injectable `executor` so the scheduler is
 *   fully testable without spawning real processes. The default executor
 *   spawns the command detached and tracks the child PID.
 * - Scheduling is pull-based via `runDueJobs()` (called on a timer by the
 *   session runtime), which keeps timing deterministic and testable.
 */

import { spawn } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { getAgentDir } from "../config.ts";

export type JobState = "queued" | "running" | "completed" | "failed" | "cancelled" | "scheduled";

export type ScheduleKind = "once" | "interval" | "cron";

export interface JobSchedule {
	kind: ScheduleKind;
	/** For `once`: epoch ms to run. For `interval`: ms between runs. */
	at?: number;
	intervalMs?: number;
	/**
	 * For `cron`: a simplified 5-field expression
	 * (min hour day month weekday) supporting `*` and exact values.
	 * Intentionally minimal — enough for common periodic jobs.
	 */
	cron?: string;
}

export interface JobSpec {
	name: string;
	command: string;
	cwd?: string;
	schedule?: JobSchedule;
	recurring?: boolean;
	maxRetries?: number;
	timeoutMs?: number;
}

export interface JobRecord extends JobSpec {
	id: string;
	state: JobState;
	createdAt: number;
	updatedAt: number;
	startedAt?: number;
	finishedAt?: number;
	nextRunAt?: number;
	pid?: number;
	exitCode?: number;
	attempt: number;
	lastError?: string;
	outputPath?: string;
	history: Array<{
		attempt: number;
		startedAt: number;
		finishedAt: number;
		exitCode?: number;
		error?: string;
	}>;
}

export interface JobExecutorResult {
	exitCode: number;
	output: string;
	pid?: number;
}

export type JobExecutor = (spec: JobSpec, record: JobRecord) => Promise<JobExecutorResult>;

export interface JobSchedulerOptions {
	storePath?: string;
	executor?: JobExecutor;
	now?: () => number;
}

interface JobStore {
	version: number;
	jobs: Record<string, JobRecord>;
	seq: number;
}

const MAX_HISTORY = 20;

function createEmptyStore(): JobStore {
	return { version: 1, jobs: {}, seq: 0 };
}

function randomId(): string {
	return Math.random().toString(36).slice(2, 10);
}

/**
 * Compute the next run time for a scheduled job.
 * Returns undefined when the schedule cannot produce a future run
 * (e.g. a one-shot that has already fired).
 */
export function computeNextRun(schedule: JobSchedule, from: number): number | undefined {
	if (schedule.kind === "once") {
		return schedule.at;
	}
	if (schedule.kind === "interval") {
		const interval = schedule.intervalMs ?? 0;
		if (interval <= 0) return undefined;
		return from + interval;
	}
	if (schedule.kind === "cron") {
		return nextCronRun(schedule.cron ?? "", from);
	}
	return undefined;
}

function matchesCronField(value: number, field: string): boolean {
	if (field === "*") return true;
	// Support comma lists and ranges: "1,2", "1-5".
	for (const part of field.split(",")) {
		if (part.includes("-")) {
			const [lo, hi] = part.split("-").map((n) => Number.parseInt(n, 10));
			if (value >= lo && value <= hi) return true;
		} else if (Number.parseInt(part, 10) === value) {
			return true;
		}
	}
	return false;
}

/** Minimal cron matcher: returns the next matching epoch ms >= from. */
export function nextCronRun(expr: string, from: number): number | undefined {
	const fields = expr.trim().split(/\s+/);
	if (fields.length !== 5) return undefined;
	const [minF, hourF, dayF, monthF, dowF] = fields;
	// Start at the next minute boundary.
	let t = Math.ceil(from / 60_000) * 60_000;
	const limit = from + 366 * 24 * 60 * 60 * 1000; // search up to a year ahead
	while (t < limit) {
		const d = new Date(t);
		const minute = d.getMinutes();
		const hour = d.getHours();
		const day = d.getDate();
		const month = d.getMonth() + 1;
		const dow = d.getDay();
		if (
			matchesCronField(minute, minF) &&
			matchesCronField(hour, hourF) &&
			matchesCronField(day, dayF) &&
			matchesCronField(month, monthF) &&
			matchesCronField(dow, dowF)
		) {
			return t;
		}
		t += 60_000;
	}
	return undefined;
}

/** Default executor: spawn the command detached and capture output. */
export function spawnExecutor(spec: JobSpec, record: JobRecord): Promise<JobExecutorResult> {
	return new Promise((resolve, reject) => {
		const outputPath = record.outputPath ?? join(getAgentDir(), `job-${record.id}.log`);
		mkdirSync(dirname(outputPath), { recursive: true });
		const stream = createWriteStream(outputPath);
		const child = spawn(spec.command, {
			shell: true,
			cwd: spec.cwd,
			detached: process.platform !== "win32",
			stdio: ["ignore", "pipe", "pipe"],
		});
		const pid = child.pid;
		if (pid !== undefined) child.unref();
		let output = "";
		child.stdout?.on("data", (chunk: Buffer) => {
			const s = chunk.toString();
			output += s;
			stream.write(s);
		});
		child.stderr?.on("data", (chunk: Buffer) => {
			const s = chunk.toString();
			output += s;
			stream.write(s);
		});
		const finish = (exitCode: number) => {
			stream.end();
			resolve({ exitCode, output, pid });
		};
		child.on("error", (err: Error) => {
			stream.end();
			reject(err);
		});
		child.on("close", (code: number | null) => {
			finish(code ?? 1);
		});
	});
}

// Local import to avoid top-level node:fs side effects in tests that never

export class JobScheduler {
	private store: JobStore;
	private readonly storePath: string;
	private readonly executor: JobExecutor;
	private readonly now: () => number;

	constructor(options: JobSchedulerOptions = {}) {
		this.storePath = options.storePath ?? join(getAgentDir(), "jobs.json");
		this.executor = options.executor ?? spawnExecutor;
		this.now = options.now ?? Date.now;
		this.store = this.load();
	}

	private load(): JobStore {
		try {
			if (existsSync(this.storePath)) {
				const parsed = JSON.parse(readFileSync(this.storePath, "utf-8")) as JobStore;
				if (parsed.version === 1 && parsed.jobs) return parsed;
			}
		} catch {
			// Corrupt store; start fresh.
		}
		return createEmptyStore();
	}

	private save(): void {
		const dir = dirname(this.storePath);
		if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
		writeFileSync(this.storePath, JSON.stringify(this.store, null, 2), "utf-8");
	}

	/** Enqueue a new job (immediate or scheduled). */
	enqueue(spec: JobSpec): JobRecord {
		const now = this.now();
		this.store.seq++;
		const id = `job-${this.store.seq}-${randomId()}`;
		let state: JobState = "queued";
		let nextRunAt: number | undefined;
		if (spec.schedule) {
			nextRunAt = computeNextRun(spec.schedule, now);
			state = spec.schedule.kind === "once" && nextRunAt && nextRunAt <= now ? "queued" : "scheduled";
		}
		const record: JobRecord = {
			...spec,
			id,
			state,
			createdAt: now,
			updatedAt: now,
			nextRunAt,
			attempt: 0,
			history: [],
			outputPath: join(getAgentDir(), `job-${id}.log`),
		};
		this.store.jobs[id] = record;
		this.save();
		return record;
	}

	/** List jobs, newest first. */
	list(): JobRecord[] {
		return Object.values(this.store.jobs).sort((a, b) => b.createdAt - a.createdAt);
	}

	/** Get a single job by id. */
	get(id: string): JobRecord | undefined {
		return this.store.jobs[id];
	}

	/** Cancel a queued/scheduled/running job. */
	cancel(id: string): boolean {
		const job = this.store.jobs[id];
		if (!job) return false;
		if (job.state === "completed" || job.state === "failed" || job.state === "cancelled") {
			return false;
		}
		job.state = "cancelled";
		job.updatedAt = this.now();
		this.save();
		return true;
	}

	/** Remove a job from the store entirely. */
	remove(id: string): boolean {
		if (!this.store.jobs[id]) return false;
		delete this.store.jobs[id];
		this.save();
		return true;
	}

	/**
	 * Resume a finished (failed/cancelled/completed) job by re-enqueuing it.
	 * Preserves the original identity-less copy semantics: a fresh attempt
	 * record is created so history is retained.
	 */
	resume(id: string): JobRecord | undefined {
		const job = this.store.jobs[id];
		if (!job) return undefined;
		if (job.state === "running" || job.state === "queued" || job.state === "scheduled") {
			return undefined;
		}
		job.state = "queued";
		job.nextRunAt = undefined;
		job.attempt = 0;
		job.exitCode = undefined;
		job.lastError = undefined;
		job.startedAt = undefined;
		job.finishedAt = undefined;
		job.updatedAt = this.now();
		this.save();
		return job;
	}

	/** Run a single job to completion (used by runDueJobs / tests). */
	async run(id: string): Promise<JobRecord> {
		const job = this.store.jobs[id];
		if (!job) throw new Error(`Unknown job: ${id}`);
		if (job.state === "running") return job;
		const now = this.now();
		job.state = "running";
		job.startedAt = now;
		job.attempt++;
		job.updatedAt = now;
		this.save();

		try {
			const result = await this.executor(job, job);
			const finished = this.now();
			job.exitCode = result.exitCode;
			job.pid = result.pid;
			job.finishedAt = finished;
			job.history.push({
				attempt: job.attempt,
				startedAt: now,
				finishedAt: finished,
				exitCode: result.exitCode,
			});
			if (job.history.length > MAX_HISTORY) job.history = job.history.slice(-MAX_HISTORY);
			if (result.exitCode === 0) {
				job.state = "completed";
			} else if ((job.maxRetries ?? 0) > job.attempt) {
				job.state = "queued";
			} else {
				job.state = "failed";
			}
			// Reschedule recurring jobs.
			if (job.state === "completed" && job.recurring && job.schedule) {
				job.nextRunAt = computeNextRun(job.schedule, finished);
				if (job.nextRunAt !== undefined && job.nextRunAt > finished) {
					job.state = "scheduled";
					job.attempt = 0;
				}
			}
			job.updatedAt = this.now();
			this.save();
			return job;
		} catch (err) {
			const finished = this.now();
			const message = err instanceof Error ? err.message : String(err);
			job.lastError = message;
			job.finishedAt = finished;
			job.history.push({
				attempt: job.attempt,
				startedAt: now,
				finishedAt: finished,
				error: message,
			});
			if ((job.maxRetries ?? 0) > job.attempt) {
				job.state = "queued";
			} else {
				job.state = "failed";
			}
			job.updatedAt = finished;
			this.save();
			return job;
		}
	}

	/**
	 * Execute all due queued/scheduled jobs. Returns the ids that ran.
	 * Scheduled one-shot jobs whose time has passed become queued first.
	 */
	async runDueJobs(): Promise<string[]> {
		const now = this.now();
		const ran: string[] = [];
		for (const job of Object.values(this.store.jobs)) {
			if (job.state === "scheduled" && job.nextRunAt !== undefined && job.nextRunAt <= now) {
				job.state = "queued";
				job.nextRunAt = undefined;
				job.updatedAt = now;
				this.save();
			}
			if (job.state === "queued") {
				await this.run(job.id);
				ran.push(job.id);
			}
		}
		return ran;
	}

	/** Count of jobs in each state. */
	counts(): Record<JobState, number> {
		const counts: Record<JobState, number> = {
			queued: 0,
			running: 0,
			completed: 0,
			failed: 0,
			cancelled: 0,
			scheduled: 0,
		};
		for (const job of Object.values(this.store.jobs)) {
			counts[job.state]++;
		}
		return counts;
	}
}
