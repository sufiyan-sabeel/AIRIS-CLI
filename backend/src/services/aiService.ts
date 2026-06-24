import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { MemoryService } from './memoryService';
import { Response } from 'express';

interface StreamCallbacks {
  onChunk: (content: string) => void;
  onEnd: () => void;
  onError: (error: string) => void;
}

function getOpenAIClient(): OpenAI {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY not configured');
  return new OpenAI({ apiKey: key });
}

function getGeminiClient(): GoogleGenerativeAI {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY not configured');
  return new GoogleGenerativeAI(key);
}

function getGrokClient(): OpenAI {
  const key = process.env.GROK_API_KEY;
  if (!key) throw new Error('GROK_API_KEY not configured');
  return new OpenAI({
    apiKey: key,
    baseURL: 'https://api.x.ai/v1'
  });
}

function getOpenRouterClient(): OpenAI {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('OPENROUTER_API_KEY not configured');
  return new OpenAI({
    apiKey: key,
    baseURL: 'https://openrouter.ai/api/v1'
  });
}

function getDefaultModel(provider: string): string {
  switch (provider) {
    case 'openai': return process.env.OPENAI_DEFAULT_MODEL || 'gpt-4';
    case 'grok': return process.env.GROK_DEFAULT_MODEL || 'grok-3';
    case 'openrouter': return process.env.OPENROUTER_DEFAULT_MODEL || 'anthropic/claude-3.5-sonnet';
    case 'gemini': return process.env.GEMINI_DEFAULT_MODEL || 'gemini-2.0-flash';
    default: return 'gpt-4';
  }
}

function buildMessages(userUid: string, userMessage: string, sessionId: string): OpenAI.Chat.ChatCompletionMessageParam[] {
  const systemPrompt = MemoryService.buildSystemPrompt(userUid);
  const history = MemoryService.getConversationContext(userUid, sessionId, 20);

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt }
  ];

  for (const msg of history) {
    if (msg.role === 'user' || msg.role === 'assistant') {
      messages.push({ role: msg.role as 'user' | 'assistant', content: msg.content });
    }
  }

  messages.push({ role: 'user', content: userMessage });
  return messages;
}

export async function streamChat(
  provider: string,
  userUid: string,
  userMessage: string,
  sessionId: string,
  res: Response
): Promise<void> {
  const messages = buildMessages(userUid, userMessage, sessionId);
  const model = getDefaultModel(provider);

  MemoryService.saveMessage(userUid, sessionId, 'user', userMessage);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  let fullResponse = '';

  try {
    switch (provider) {
      case 'openai':
        await streamOpenAI(messages, model, res, (chunk: string) => { fullResponse += chunk; });
        break;
      case 'grok':
        await streamGrok(messages, model, res, (chunk: string) => { fullResponse += chunk; });
        break;
      case 'openrouter':
        await streamOpenRouter(messages, model, res, (chunk: string) => { fullResponse += chunk; });
        break;
      case 'gemini':
        await streamGemini(messages, model, res, (chunk: string) => { fullResponse += chunk; });
        break;
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }

    MemoryService.saveMessage(userUid, sessionId, 'assistant', fullResponse, model);
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[AI] ${provider} error:`, error);
    res.write(`data: ${JSON.stringify({ error })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  }
}

async function streamOpenAI(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  model: string,
  res: Response,
  onChunk: (content: string) => void
): Promise<void> {
  const client = getOpenAIClient();
  const stream = await client.chat.completions.create({
    model,
    messages,
    stream: true,
    max_tokens: 2048
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      onChunk(content);
      res.write(`data: ${JSON.stringify({ content })}\n\n`);
    }
  }
}

async function streamGrok(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  model: string,
  res: Response,
  onChunk: (content: string) => void
): Promise<void> {
  const client = getGrokClient();
  const stream = await client.chat.completions.create({
    model,
    messages,
    stream: true,
    max_tokens: 2048
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      onChunk(content);
      res.write(`data: ${JSON.stringify({ content })}\n\n`);
    }
  }
}

async function streamOpenRouter(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  model: string,
  res: Response,
  onChunk: (content: string) => void
): Promise<void> {
  const client = getOpenRouterClient();
  const stream = await client.chat.completions.create({
    model,
    messages,
    stream: true,
    max_tokens: 2048
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      onChunk(content);
      res.write(`data: ${JSON.stringify({ content })}\n\n`);
    }
  }
}

async function streamGemini(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  model: string,
  res: Response,
  onChunk: (content: string) => void
): Promise<void> {
  const genAI = getGeminiClient();
  const systemMessage = messages.find(m => m.role === 'system');
  const systemText = systemMessage && typeof systemMessage.content === 'string' ? systemMessage.content : undefined;

  const geminiModel = genAI.getGenerativeModel({
    model,
    systemInstruction: systemText || 'You are AIRIS, a helpful AI assistant.'
  });

  const contents = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' as const : 'user' as const,
      parts: [{ text: typeof m.content === 'string' ? m.content : '' }]
    }));

  const result = await geminiModel.generateContentStream({ contents });

  for await (const chunk of result.stream) {
    const content = chunk.text();
    if (content) {
      onChunk(content);
      res.write(`data: ${JSON.stringify({ content })}\n\n`);
    }
  }
}

export async function chatNonStream(
  provider: string,
  userUid: string,
  userMessage: string,
  sessionId: string
): Promise<{ content: string; model: string }> {
  const messages = buildMessages(userUid, userMessage, sessionId);
  const model = getDefaultModel(provider);

  MemoryService.saveMessage(userUid, sessionId, 'user', userMessage);

  let content = '';

  switch (provider) {
    case 'openai': {
      const client = getOpenAIClient();
      const result = await client.chat.completions.create({
        model, messages, max_tokens: 2048
      });
      content = result.choices[0]?.message?.content || '';
      break;
    }
    case 'grok': {
      const client = getGrokClient();
      const result = await client.chat.completions.create({
        model, messages, max_tokens: 2048
      });
      content = result.choices[0]?.message?.content || '';
      break;
    }
    case 'openrouter': {
      const client = getOpenRouterClient();
      const result = await client.chat.completions.create({
        model, messages, max_tokens: 2048
      });
      content = result.choices[0]?.message?.content || '';
      break;
    }
    case 'gemini': {
      const genAI = getGeminiClient();
      const systemMessage = messages.find(m => m.role === 'system');
      const systemText = systemMessage && typeof systemMessage.content === 'string' ? systemMessage.content : undefined;
      const geminiModel = genAI.getGenerativeModel({
        model,
        systemInstruction: systemText || 'You are AIRIS, a helpful AI assistant.'
      });
      const contents = messages
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role === 'assistant' ? 'model' as const : 'user' as const,
          parts: [{ text: typeof m.content === 'string' ? m.content : '' }]
        }));
      const result = await geminiModel.generateContent({ contents });
      content = result.response?.text() || '';
      break;
    }
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }

  MemoryService.saveMessage(userUid, sessionId, 'assistant', content, model);
  return { content, model };
}
