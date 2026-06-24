export interface FAQItem {
  question: string;
  answer: string;
}

export const faqItems: FAQItem[] = [
  {
    question: "What is AIRIS CLI?",
    answer:
      "AIRIS (Artificial Intelligence Responsive Integrated System) is a local-first AI coding agent that runs in your terminal. It reads code, executes shell commands, edits files, and manages sessions, giving you an AI pair programmer that works where you work.",
  },
  {
    question: "How do I install AIRIS?",
    answer:
      "Run the one-liner: curl -fsSL https://airis-dev.netlify.app/install.sh | sh. This downloads the latest prebuilt binary for your platform. You can also install from source by cloning the repository and running npm run build.",
  },
  {
    question: "Which providers are supported?",
    answer:
      "AIRIS supports 25+ providers including Google Gemini, Anthropic Claude, OpenAI, Groq, Mistral, DeepSeek, OpenRouter, Amazon Bedrock, and local models via Ollama. Set the appropriate environment variable for your chosen provider.",
  },
  {
    question: "Do I need an API key?",
    answer:
      "Yes, unless you use Ollama for local models. Get a free API key from Google Gemini at aistudio.google.com, or use keys from Anthropic, OpenAI, or other providers. Set the key as an environment variable before starting AIRIS.",
  },
  {
    question: "Can I use AIRIS on Android?",
    answer:
      "Yes. AIRIS runs natively on Android through Termux. Install Termux from F-Droid (not Play Store), then install Node.js and the AIRIS npm package. All features work including file operations, session management, and themes.",
  },
  {
    question: "What is airis ship?",
    answer:
      "airis ship is a full-lifecycle development workflow. It creates a mission contract, tracks TODOs, runs formatting and testing, generates verification proofs, and optionally commits your changes. Start with: airis ship start \"your task\".",
  },
  {
    question: "Is there a read-only mode?",
    answer:
      "Yes. Use airis --no-tools to disable all tools, or airis --tools read,grep,find,ls to allow only read-only tools. This is useful when you want AI analysis without file modifications.",
  },
  {
    question: "How do I update AIRIS?",
    answer:
      "Run airis update to update AIRIS and all extensions. If installed via npm, use npm update -g @sufiyan-sabeel/airis-cli. If built from source, pull the latest changes and rebuild.",
  },
];
