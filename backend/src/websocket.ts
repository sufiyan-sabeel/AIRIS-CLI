import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { Server } from 'http';

interface IDEConnection {
  ws: WebSocket;
  id: string;
  projectDir?: string;
  connectedAt: Date;
}

const connections = new Map<string, IDEConnection>();

function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

export function setupWebSocket(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const id = generateId();
    const connection: IDEConnection = {
      ws,
      id,
      connectedAt: new Date(),
    };
    connections.set(id, connection);

    console.log(`[WS] Client connected: ${id} (${connections.size} total)`);

    // Send welcome message
    ws.send(JSON.stringify({
      type: 'connected',
      id,
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    }));

    ws.on('message', (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString());

        switch (msg.type) {
          case 'ping':
            ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
            break;

          case 'open_project':
            connection.projectDir = msg.path;
            ws.send(JSON.stringify({
              type: 'project_opened',
              path: msg.path,
              files: [], // In production, would list files
            }));
            break;

          case 'read_file':
            // Simulated file read - in production would use fs
            ws.send(JSON.stringify({
              type: 'file_content',
              path: msg.path,
              content: `// ${msg.path}\n// File content would be loaded from the server\n`,
            }));
            break;

          case 'write_file':
            ws.send(JSON.stringify({
              type: 'file_written',
              path: msg.path,
              success: true,
            }));
            break;

          case 'run_command':
            // Simulated command execution
            ws.send(JSON.stringify({
              type: 'command_output',
              command: msg.command,
              output: `$ ${msg.command}\n> Command execution simulated\n`,
              exitCode: 0,
            }));
            break;

          case 'get_version':
            ws.send(JSON.stringify({
              type: 'version_info',
              version: '0.79.8',
              buildDate: '2026-07-13',
              gitCommit: process.env.GIT_COMMIT || 'development',
            }));
            break;

          default:
            ws.send(JSON.stringify({
              type: 'error',
              message: `Unknown message type: ${msg.type}`,
            }));
        }
      } catch (err) {
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Invalid message format',
        }));
      }
    });

    ws.on('close', () => {
      connections.delete(id);
      console.log(`[WS] Client disconnected: ${id} (${connections.size} remaining)`);
    });

    ws.on('error', (err) => {
      console.error(`[WS] Error for ${id}:`, err.message);
      connections.delete(id);
    });
  });

  // Broadcast message to all connected clients
  wss.broadcast = (data: string) => {
    connections.forEach((conn) => {
      if (conn.ws.readyState === WebSocket.OPEN) {
        conn.ws.send(data);
      }
    });
  };

  // Periodic health check
  const interval = setInterval(() => {
    connections.forEach((conn, id) => {
      if (conn.ws.readyState === WebSocket.OPEN) {
        conn.ws.ping();
      } else {
        connections.delete(id);
      }
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(interval);
  });

  console.log(`[WS] WebSocket server initialized on /ws`);
  return wss;
}

// Type augmentation for broadcast
declare module 'ws' {
  interface WebSocketServer {
    broadcast: (data: string) => void;
  }
}
