export interface Provider {
  name: string;
  envVar: string;
  local?: boolean;
}

export const providers: Provider[] = [
  { name: "Google Gemini", envVar: "GEMINI_API_KEY" },
  { name: "Anthropic Claude", envVar: "ANTHROPIC_API_KEY" },
  { name: "OpenAI GPT", envVar: "OPENAI_API_KEY" },
  { name: "Groq", envVar: "GROQ_API_KEY" },
  { name: "Mistral", envVar: "MISTRAL_API_KEY" },
  { name: "DeepSeek", envVar: "DEEPSEEK_API_KEY" },
  { name: "OpenRouter", envVar: "OPENROUTER_API_KEY" },
  { name: "Amazon Bedrock", envVar: "AWS_BEARER_TOKEN_BEDROCK" },
  { name: "Ollama", envVar: "No key needed", local: true },
];
