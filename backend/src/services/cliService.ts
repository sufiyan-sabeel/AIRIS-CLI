import { spawn, SpawnOptions } from 'child_process';
import path from 'path';
import { Response } from 'express';
import { MemoryService } from './memoryService';

const CLI_ROOT = process.env.CLI_ROOT || '/usr/local/bin';
const AIRIS_BIN = process.env.AIRIS_BIN || '/usr/local/bin/airis';

const DANGEROUS_PATTERNS: RegExp[] = [
  /\brm\s+-rf\s+\//i,
  /\bmkfs\b/i,
  /\bdd\b.*of=\/dev\//i,
  /\bformat\b.*\/dev\//i,
  /\bshutdown\b/i,
  /\breboot\b/i,
  /\bkill\s+-9\s+1\b/i,
  /\bsudo\s+rm\b/i,
  /\bchmod\s+777\b/i
];

interface CommandValidation {
  valid: boolean;
  reason?: string;
}

function validateCommand(command: string): CommandValidation {
  if (!command || typeof command !== 'string') {
    return { valid: false, reason: 'Command is empty or invalid' };
  }

  if (command.length > 4096) {
    return { valid: false, reason: 'Command too long (max 4096 characters)' };
  }

  if (DANGEROUS_PATTERNS.some(pattern => pattern.test(command))) {
    return { valid: false, reason: 'Command contains dangerous patterns and was blocked for safety' };
  }

  return { valid: true };
}

export function executeCliCommand(
  command: string,
  workDir: string | undefined,
  userUid: string,
  res: Response
): void {
  const validation = validateCommand(command);

  if (!validation.valid) {
    res.writeHead(400, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    res.write(`data: ${JSON.stringify({ error: validation.reason })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
    return;
  }

  const task = MemoryService.createTask(userUid, `cli:${command.substring(0, 50)}`, command);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  res.write(`data: ${JSON.stringify({ taskId: task.id, status: 'running' })}\n\n`);

  const cwd = workDir || CLI_ROOT;
  let stdout = '';
  let stderr = '';

  const parts = command.split(/\s+/);
  const cmd = parts[0];
  const args = parts.slice(1);

  const spawnOptions: SpawnOptions = {
    cwd,
    env: { ...process.env, NODE_ENV: 'production' } as NodeJS.ProcessEnv,
    shell: false
  };

  let proc;
  if (cmd === 'node' || cmd === 'npm' || cmd === 'npx') {
    proc = spawn(cmd, args, spawnOptions);
  } else {
    proc = spawn('sh', ['-c', command], spawnOptions);
  }

  proc.stdout?.on('data', (data: Buffer) => {
    const text = data.toString();
    stdout += text;
    res.write(`data: ${JSON.stringify({ stream: 'stdout', output: text })}\n\n`);
  });

  proc.stderr?.on('data', (data: Buffer) => {
    const text = data.toString();
    stderr += text;
    res.write(`data: ${JSON.stringify({ stream: 'stderr', output: text })}\n\n`);
  });

  proc.on('error', (err: Error) => {
    stderr += err.message;
    res.write(`data: ${JSON.stringify({ stream: 'stderr', output: err.message })}\n\n`);
    MemoryService.completeTask(task.id, 'failed', stderr);
    res.write(`data: ${JSON.stringify({ status: 'failed', taskId: task.id, exitCode: -1 })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  });

  proc.on('close', (code: number | null) => {
    const status = code === 0 ? 'completed' : 'failed';
    const output = stdout || stderr;
    MemoryService.completeTask(task.id, status, output.substring(0, 10000));
    res.write(`data: ${JSON.stringify({ status, taskId: task.id, exitCode: code })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  });
}

export interface CliResult {
  output: string;
  exitCode: number | null;
  taskId: number;
  status: string;
}

export function executeCliNonStream(
  command: string,
  workDir: string | undefined,
  userUid: string
): Promise<CliResult> {
  return new Promise((resolve, reject) => {
    const validation = validateCommand(command);
    if (!validation.valid) {
      return reject(new Error(validation.reason));
    }

    const task = MemoryService.createTask(userUid, `cli:${command.substring(0, 50)}`, command);
    const cwd = workDir || CLI_ROOT;

    const parts = command.split(/\s+/);
    const cmd = parts[0];
    const args = parts.slice(1);

    const spawnOptions: SpawnOptions = {
      cwd,
      env: { ...process.env, NODE_ENV: 'production' } as NodeJS.ProcessEnv,
      shell: false
    };

    let proc;
    if (cmd === 'node' || cmd === 'npm' || cmd === 'npx') {
      proc = spawn(cmd, args, spawnOptions);
    } else {
      proc = spawn('sh', ['-c', command], spawnOptions);
    }

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data: Buffer) => { stdout += data.toString(); });
    proc.stderr?.on('data', (data: Buffer) => { stderr += data.toString(); });

    proc.on('error', (err: Error) => {
      MemoryService.completeTask(task.id, 'failed', err.message);
      reject(err);
    });

    proc.on('close', (code: number | null) => {
      const status = code === 0 ? 'completed' : 'failed';
      const output = stdout || stderr;
      MemoryService.completeTask(task.id, status, output.substring(0, 10000));
      resolve({ output, exitCode: code, taskId: task.id, status });
    });
  });
}
