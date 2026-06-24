import { queryAll, queryOne, run } from '../config/database';
import { ChatMessage, ContextMemory, AutomationTask } from '../types';

export class MemoryService {
  static saveMessage(userUid: string, sessionId: string, role: string, content: string, modelUsed: string = ''): void {
    run(
      `INSERT INTO chat_history (user_uid, session_id, role, content, model_used) VALUES (?, ?, ?, ?, ?)`,
      [userUid, sessionId, role, content, modelUsed]
    );
  }

  static getConversationContext(userUid: string, sessionId: string, limit: number = 20): ChatMessage[] {
    return queryAll(
      `SELECT role, content, model_used, timestamp
       FROM chat_history
       WHERE user_uid = ? AND session_id = ?
       ORDER BY id DESC
       LIMIT ?`,
      [userUid, sessionId, limit]
    ).reverse() as ChatMessage[];
  }

  static getRecentHistory(userUid: string, limit: number = 50): ChatMessage[] {
    return queryAll(
      `SELECT role, content, timestamp
       FROM chat_history
       WHERE user_uid = ?
       ORDER BY id DESC
       LIMIT ?`,
      [userUid, limit]
    ).reverse() as ChatMessage[];
  }

  static buildSystemPrompt(userUid: string): string {
    const memories = queryAll(
      `SELECT key, value, type, timestamp FROM context_memory WHERE user_uid = ? ORDER BY timestamp DESC LIMIT ?`,
      [userUid, 10]
    ) as ContextMemory[];

    const recentHistory = queryAll(
      `SELECT role, content, timestamp FROM chat_history WHERE user_uid = ? ORDER BY id DESC LIMIT ?`,
      [userUid, 10]
    ) as ChatMessage[];

    let systemPrompt = 'You are AIRIS, a personal AI assistant. You help with coding, automation, and general tasks. Be concise, technical, and helpful.';

    if (memories.length > 0) {
      systemPrompt += '\n\nUser preferences and context:';
      for (const mem of memories) {
        systemPrompt += `\n- ${mem.key}: ${mem.value}`;
      }
    }

    if (recentHistory.length > 0) {
      systemPrompt += '\n\nRecent conversation context:';
      for (const msg of recentHistory.slice(-6)) {
        const truncated = msg.content.substring(0, 200);
        systemPrompt += `\n${msg.role}: ${truncated}`;
      }
    }

    return systemPrompt;
  }

  static saveMemory(userUid: string, key: string, value: string, type: string = 'general'): void {
    run(
      `INSERT INTO context_memory (user_uid, key, value, type)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_uid, key) DO UPDATE SET
         value = excluded.value,
         type = excluded.type,
         timestamp = datetime('now')`,
      [userUid, key, value, type]
    );
  }

  static getMemoryValue(userUid: string, key: string): ContextMemory | undefined {
    return queryOne(
      `SELECT key, value, type, timestamp FROM context_memory WHERE user_uid = ? AND key = ?`,
      [userUid, key]
    ) as ContextMemory | undefined;
  }

  static getAllMemories(userUid: string, limit: number = 50): ContextMemory[] {
    return queryAll(
      `SELECT key, value, type, timestamp FROM context_memory WHERE user_uid = ? ORDER BY timestamp DESC LIMIT ?`,
      [userUid, limit]
    ) as ContextMemory[];
  }

  static deleteMemoryEntry(userUid: string, key: string): void {
    run(`DELETE FROM context_memory WHERE user_uid = ? AND key = ?`, [userUid, key]);
  }

  static createTask(userUid: string, name: string, command: string): AutomationTask {
    const result = run(
      `INSERT INTO automation_tasks (user_uid, name, command, status) VALUES (?, ?, ?, 'pending')`,
      [userUid, name, command]
    );
    return {
      id: result.lastInsertRowid,
      user_uid: userUid,
      name,
      command,
      status: 'pending',
      output: '',
      created_at: new Date().toISOString(),
      completed_at: null
    };
  }

  static getTasks(userUid: string, limit: number = 50): AutomationTask[] {
    return queryAll(
      `SELECT id, user_uid, name, command, status, output, created_at, completed_at
       FROM automation_tasks WHERE user_uid = ? ORDER BY created_at DESC LIMIT ?`,
      [userUid, limit]
    ) as AutomationTask[];
  }

  static getPendingTasks(): AutomationTask[] {
    return queryAll(
      `SELECT id, user_uid, name, command FROM automation_tasks WHERE status = 'pending' ORDER BY created_at ASC`
    ) as AutomationTask[];
  }

  static completeTask(taskId: number, status: string, output: string): void {
    run(
      `UPDATE automation_tasks SET status = ?, output = ?, completed_at = datetime('now') WHERE id = ?`,
      [status, output.substring(0, 10000), taskId]
    );
  }

  static getTaskById(taskId: number): AutomationTask | undefined {
    return queryOne(
      `SELECT id, user_uid, name, command, status FROM automation_tasks WHERE id = ?`,
      [taskId]
    ) as AutomationTask | undefined;
  }
}
