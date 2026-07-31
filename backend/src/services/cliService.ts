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

const SECRET_VALUE_RE = /(\b(?:api[_-]?key|token|secret|password|authorization)\b[\s"':=]+)([^\s"',}]+)/gi;
const BEARER_RE = /\bBearer\s+[A-Za-z0-9._~+/=-]+/g;
const EXPLICIT_SECRET_PATTERNS = [
  /sk-ant-[a-zA-Z0-9-_]{40,}/gi,
  /sk-proj-[a-zA-Z0-9-_]{40,}/gi,
  /sk-[a-zA-Z0-9]{20,}/gi,
  /AIzaSy[a-zA-Z0-9_-]{35}/gi,
  /xai-[a-zA-Z0-9]{40,}/gi,
];

function sanitizeSecrets(text: string): string {
  let sanitized = text.replace(SECRET_VALUE_RE, "$1[redacted]").replace(BEARER_RE, "Bearer [redacted]");
  for (const pattern of EXPLICIT_SECRET_PATTERNS) {
    sanitized = sanitized.replace(pattern, "[redacted]");
  }
  return sanitized;
}

interface CommandValidation {
  valid: boolean;
  reason?: string;
}

function resolveAndValidateWorkDir(workDir: string | undefined): string {
  if (!workDir) {
    return CLI_ROOT;
  }
  const resolved = path.resolve(CLI_ROOT, workDir);
  const relative = path.relative(CLI_ROOT, resolved);
  const isSafe = !relative.startsWith('..') && !path.isAbsolute(relative);
  if (!isSafe) {
    throw new Error('Path traversal detected: workDir must resolve inside CLI_ROOT');
  }
  return resolved;
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
  let cwd = CLI_ROOT;
  try {
    cwd = resolveAndValidateWorkDir(workDir);
  } catch (err: any) {
    res.writeHead(400, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
    return;
  }

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
    const text = sanitizeSecrets(data.toString());
    stdout += text;
    res.write(`data: ${JSON.stringify({ stream: 'stdout', output: text })}\n\n`);
  });

  proc.stderr?.on('data', (data: Buffer) => {
    const text = sanitizeSecrets(data.toString());
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
    let cwd = CLI_ROOT;
    try {
      cwd = resolveAndValidateWorkDir(workDir);
    } catch (err: any) {
      return reject(err);
    }

    const validation = validateCommand(command);
    if (!validation.valid) {
      return reject(new Error(validation.reason));
    }

    const task = MemoryService.createTask(userUid, `cli:${command.substring(0, 50)}`, command);

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

    proc.stdout?.on('data', (data: Buffer) => { stdout += sanitizeSecrets(data.toString()); });
    proc.stderr?.on('data', (data: Buffer) => { stderr += sanitizeSecrets(data.toString()); });

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
