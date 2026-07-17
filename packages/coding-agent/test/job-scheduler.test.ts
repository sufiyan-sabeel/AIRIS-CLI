import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	computeNextRun,
	JobScheduler,
	nextCronRun,
	type JobExecutor,
	type JobExecutorResult,
} from "../src/core/job-scheduler.ts";

let tmpDir: string;
let storePath: string;

beforeEach(() => {
	tmpDir = join(tmpdir(), `airis-jobs-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
	mkdirSync(tmpDir, { recursive: true });
	storePath = join(tmpDir, "jobs.json");
});

afterEach(() => {
	if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
});

function fakeExecutor(map: Record<string, JobExecutorResult>): JobExecutor {
	return async (spec) => map[spec.name] ?? { exitCode: 0, output: "" };
}

describe("computeNextRun", () => {
	it("returns the scheduled time for a one-shot", () => {
		expect(computeNextRun({ kind: "once", at: 5000 }, 0)).toBe(5000);
	});

	it("adds the interval for interval schedules", () => {
		expect(computeNextRun({ kind: "interval", intervalMs: 1000 }, 1000)).toBe(2000);
	});

	it("computes the next cron run", () => {
		// Every hour at minute 0.
		const next = nextCronRun("0 * * * *", 0);
		expect(next).not.toBeUndefined();
		expect(new Date(next as number).getMinutes()).toBe(0);
	});

	it("returns undefined for a malformed cron", () => {
		expect(nextCronRun("bad", 0)).toBeUndefined();
	});
});

describe("JobScheduler", () => {
	it("enqueues and lists jobs", () => {
		const scheduler = new JobScheduler({ storePath, now: () => 1000 });
		const job = scheduler.enqueue({ name: "build", command: "echo hi", cwd: tmpDir });
		expect(job.state).toBe("queued");
		expect(scheduler.list()).toHaveLength(1);
	});

	it("persists jobs to disk", () => {
		const scheduler = new JobScheduler({ storePath, now: () => 1000 });
		scheduler.enqueue({ name: "build", command: "echo hi" });
		const reloaded = new JobScheduler({ storePath, now: () => 1000 });
		expect(reloaded.list()).toHaveLength(1);
	});

	it("runs a queued job and records completion", async () => {
		const scheduler = new JobScheduler({
			storePath,
			now: () => 1000,
			executor: fakeExecutor({ build: { exitCode: 0, output: "ok" } }),
		});
		const job = scheduler.enqueue({ name: "build", command: "echo hi" });
		const ran = await scheduler.run(job.id);
		expect(ran.state).toBe("completed");
		expect(ran.exitCode).toBe(0);
		expect(ran.attempt).toBe(1);
	});

	it("marks failed jobs and respects maxRetries", async () => {
		const scheduler = new JobScheduler({
			storePath,
			now: () => 1000,
			executor: fakeExecutor({ build: { exitCode: 1, output: "err" } }),
		});
		const job = scheduler.enqueue({ name: "build", command: "false", maxRetries: 0 });
		const ran = await scheduler.run(job.id);
		expect(ran.state).toBe("failed");
		expect(ran.exitCode).toBe(1);
	});

	it("re-queues on failure when retries remain", async () => {
		const scheduler = new JobScheduler({
			storePath,
			now: () => 1000,
			executor: fakeExecutor({ build: { exitCode: 1, output: "err" } }),
		});
		const job = scheduler.enqueue({ name: "build", command: "false", maxRetries: 2 });
		const ran = await scheduler.run(job.id);
		expect(ran.state).toBe("queued");
		expect(ran.attempt).toBe(1);
	});

	it("runs due scheduled jobs via runDueJobs", async () => {
		const scheduler = new JobScheduler({
			storePath,
			now: () => 1000,
			executor: fakeExecutor({ build: { exitCode: 0, output: "ok" } }),
		});
		scheduler.enqueue({
			name: "build",
			command: "echo hi",
			schedule: { kind: "once", at: 900 },
		});
		const ran = await scheduler.runDueJobs();
		expect(ran).toHaveLength(1);
		expect(scheduler.list()[0].state).toBe("completed");
	});

	it("reschedules recurring interval jobs", async () => {
		const scheduler = new JobScheduler({
			storePath,
			now: () => 1000,
			executor: fakeExecutor({ build: { exitCode: 0, output: "ok" } }),
		});
		const job = scheduler.enqueue({
			name: "build",
			command: "echo hi",
			recurring: true,
			schedule: { kind: "interval", intervalMs: 5000 },
		});
		expect(job.state).toBe("scheduled");
		const ran = await scheduler.run(job.id);
		expect(ran.state).toBe("scheduled");
		expect(ran.nextRunAt).toBe(6000);
	});

	it("cancels a queued job", () => {
		const scheduler = new JobScheduler({ storePath, now: () => 1000 });
		const job = scheduler.enqueue({ name: "build", command: "echo hi" });
		expect(scheduler.cancel(job.id)).toBe(true);
		expect(scheduler.get(job.id)?.state).toBe("cancelled");
	});

	it("resumes a failed job", () => {
		const scheduler = new JobScheduler({ storePath, now: () => 1000 });
		const job = scheduler.enqueue({ name: "build", command: "echo hi" });
		job.state = "failed";
		job.updatedAt = 1000;
		scheduler.save();
		const resumed = scheduler.resume(job.id);
		expect(resumed?.state).toBe("queued");
		expect(resumed?.attempt).toBe(0);
	});

	it("removes a job", () => {
		const scheduler = new JobScheduler({ storePath, now: () => 1000 });
		const job = scheduler.enqueue({ name: "build", command: "echo hi" });
		expect(scheduler.remove(job.id)).toBe(true);
		expect(scheduler.get(job.id)).toBeUndefined();
	});

	it("reports state counts", () => {
		const scheduler = new JobScheduler({ storePath, now: () => 1000 });
		scheduler.enqueue({ name: "a", command: "echo 1" });
		scheduler.enqueue({ name: "b", command: "echo 2" });
		const counts = scheduler.counts();
		expect(counts.queued).toBe(2);
	});
});
