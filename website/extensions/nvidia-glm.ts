"use airis";

// AIRIS extension for NVIDIA-hosted GLM-5.2 model
// Load with: airis --extension ./nvidia-glm.ts

airis.registerProvider({
  name: "nvidia-glm",
  identifier: "nvidia-glm",
  icon: "⚡",
  credentials: [
    {
      name: "API_KEY",
      pattern: /^nvapi-[a-zA-Z0-9_-]+$/,
      help: "NVIDIA API key (example: nvapi-dcuncInR...) from https://integrate.api.nvidia.com",
      required: true,
      requiredEnvironmentVariable: "NVIDIA_GLM_AAIRIS_KEY",
    },
  ],
  models: [
    {
      name: "GLM-5.2",
      identifier: "z-ai/glm-5.2",
      icon: "🔵",
      speed: "fast",
      reasoning: "strong",
      streaming: true,
    }
  ],
  api: {
    baseURL: "https://integrate.api.nvidia.com/v1",
    compatibility: "openai",
    headers: (credentials) => ({ "Authorization": `Bearer ${credentials.API_KEY}` }),
  },
});

console.log(`✅ NVIDIA GLM extension loaded`);
console.log(`\nTo use:`);
console.log(`1. export NVIDIA_GLM_AAIRIS_KEY="nvapi-dcuncInR..."