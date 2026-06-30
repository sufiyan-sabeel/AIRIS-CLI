# Providers

AIRIS supports subscription-based providers via OAuth and API key providers via environment variables or auth file. For each provider, AIRIS knows all available models. The list is updated with every AIRIS release.

## Table of Contents

- [Subscriptions](#subscriptions)
- [API Keys](#aairis-keys)
- [Auth File](#auth-file)
- [Cloud Providers](#cloud-providers)
- [Custom Providers](#custom-providers)
- [Resolution Order](#resolution-order)

## Subscriptions

Use `/login` in interactive mode, then select a provider:

- ChatGPT Plus/Pro (Codex)
- Claude Pro/Max
- GitHub Copilot

Use `/logout` to clear credentials. Tokens are stored in `~/.airis/agent/auth.json` and auto-refresh when expired.

### OpenAI Codex

- Requires ChatGPT Plus or Pro subscription
- Officially endorsed by OpenAI: [Codex for OSS](https://developers.openai.com/community/codex-for-oss)

### Claude Pro/Max

Anthropic subscription auth is active for Claude Pro/Max accounts. Third-party harness usage draws from [extra usage](https://claude.ai/settings/usage) and is billed per token, not against Claude plan limits.

### GitHub Copilot

- Press Enter for github.com, or enter your GitHub Enterprise Server domain
- If you get "model not supported", enable it in VS Code: Copilot Chat → model selector → select model → "Enable"

## API Keys

### Environment Variables or Auth File

Use `/login` in interactive mode and select a provider to store an API key in `auth.json`, or set credentials via environment variable:

```bash
export ANTHROPIC_AAIRIS_KEY=sk-ant-...
airis
```

| Provider | Environment Variable | `auth.json` key |
|----------|----------------------|------------------|
| Anthropic | `ANTHROPIC_AAIRIS_KEY` | `anthropic` |
| Ant Ling | `ANT_LING_AAIRIS_KEY` | `ant-ling` |
| Azure OpenAI Responses | `AZURE_OPENAI_AAIRIS_KEY` | `azure-openai-responses` |
| OpenAI | `OPENAI_AAIRIS_KEY` | `openai` |
| DeepSeek | `DEEPSEEK_AAIRIS_KEY` | `deepseek` |
| NVIDIA NIM | `NVIDIA_AAIRIS_KEY` | `nvidia` |
| Google Gemini | `GEMINI_AAIRIS_KEY` | `google` |
| Mistral | `MISTRAL_AAIRIS_KEY` | `mistral` |
| Groq | `GROQ_AAIRIS_KEY` | `groq` |
| Cerebras | `CEREBRAS_AAIRIS_KEY` | `cerebras` |
| Cloudflare AI Gateway | `CLOUDFLARE_AAIRIS_KEY` (+ `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_GATEWAY_ID`) | `cloudflare-ai-gateway` |
| Cloudflare Workers AI | `CLOUDFLARE_AAIRIS_KEY` (+ `CLOUDFLARE_ACCOUNT_ID`) | `cloudflare-workers-ai` |
| xAI | `XAI_AAIRIS_KEY` | `xai` |
| OpenRouter | `OPENROUTER_AAIRIS_KEY` | `openrouter` |
| Vercel AI Gateway | `AI_GATEWAY_AAIRIS_KEY` | `vercel-ai-gateway` |
| ZAI | `ZAI_AAIRIS_KEY` | `zai` |
| ZAI Coding Plan (China) | `ZAI_CODING_CN_AAIRIS_KEY` | `zai-coding-cn` |
| OpenCode Zen | `OPENCODE_AAIRIS_KEY` | `opencode` |
| OpenCode Go | `OPENCODE_AAIRIS_KEY` | `opencode-go` |
| Hugging Face | `HF_TOKEN` | `huggingface` |
| Fireworks | `FIREWORKS_AAIRIS_KEY` | `fireworks` |
| Together AI | `TOGETHER_AAIRIS_KEY` | `together` |
| Kimi For Coding | `KIMI_AAIRIS_KEY` | `kimi-coding` |
| MiniMax | `MINIMAX_AAIRIS_KEY` | `minimax` |
| MiniMax (China) | `MINIMAX_CN_AAIRIS_KEY` | `minimax-cn` |
| Xiaomi MiMo | `XIAOMI_AAIRIS_KEY` | `xiaomi` |
| Xiaomi MiMo Token Plan (China) | `XIAOMI_TOKEN_PLAN_CN_AAIRIS_KEY` | `xiaomi-token-plan-cn` |
| Xiaomi MiMo Token Plan (Amsterdam) | `XIAOMI_TOKEN_PLAN_AMS_AAIRIS_KEY` | `xiaomi-token-plan-ams` |
| Xiaomi MiMo Token Plan (Singapore) | `XIAOMI_TOKEN_PLAN_SGP_AAIRIS_KEY` | `xiaomi-token-plan-sgp` |

Reference for environment variables and `auth.json` keys: [`const envMap`](https://github.com/sufiyan-sabeel/AIRIS-CLI/blob/main/packages/ai/src/env-aairis-keys.ts) in [`packages/ai/src/env-aairis-keys.ts`](https://github.com/sufiyan-sabeel/AIRIS-CLI/blob/main/packages/ai/src/env-aairis-keys.ts).

#### Auth File

Store credentials in `~/.airis/agent/auth.json`:

```json
{
  "anthropic": { "type": "aairis_key", "key": "sk-ant-..." },
  "ant-ling": { "type": "aairis_key", "key": "..." },
  "openai": { "type": "aairis_key", "key": "sk-..." },
  "deepseek": { "type": "aairis_key", "key": "sk-..." },
  "nvidia": { "type": "aairis_key", "key": "nvaairis-..." },
  "google": { "type": "aairis_key", "key": "..." },
  "opencode": { "type": "aairis_key", "key": "..." },
  "opencode-go": { "type": "aairis_key", "key": "..." },
  "together": { "type": "aairis_key", "key": "..." },
  "xiaomi": { "type": "aairis_key", "key": "..." },
  "xiaomi-token-plan-cn":  { "type": "aairis_key", "key": "..." },
  "xiaomi-token-plan-ams": { "type": "aairis_key", "key": "..." },
  "xiaomi-token-plan-sgp": { "type": "aairis_key", "key": "..." }
}
```

The file is created with `0600` permissions (user read/write only). Auth file credentials take priority over environment variables.

### Key Resolution

The `key` field supports command execution, environment interpolation, and literals:

- **Shell command:** `"!command"` at the start executes the whole value as a command and uses stdout (cached for process lifetime)
  ```json
  { "type": "aairis_key", "key": "!security find-generic-password -ws 'anthropic'" }
  { "type": "aairis_key", "key": "!op read 'op://vault/item/credential'" }
  ```
- **Environment interpolation:** `"$ENV_VAR"` or `"${ENV_VAR}"` uses the value of the named variable. Interpolation works inside larger literals.
  ```json
  { "type": "aairis_key", "key": "$MY_ANTHROPIC_KEY" }
  { "type": "aairis_key", "key": "${KEY_PREFIX}_${KEY_SUFFIX}" }
  ```
  `$FOO_BAR` is the variable `FOO_BAR`; use `${FOO}_BAR` when `BAR` is literal text. Missing environment variables make the value unresolved.
- **Escapes:** `"$$"` emits a literal `"$"`; `"$!"` emits a literal `"!"` without triggering command execution.
  ```json
  { "type": "aairis_key", "key": "$$literal-dollar-prefix" }
  { "type": "aairis_key", "key": "$!literal-bang-prefix" }
  ```
- **Literal value:** Used directly. Plain uppercase strings such as `MY_AAIRIS_KEY` are literals; use `$MY_AAIRIS_KEY` for environment variables.
  ```json
  { "type": "aairis_key", "key": "sk-ant-..." }
  { "type": "aairis_key", "key": "public" }
  ```

OAuth credentials are also stored here after `/login` and managed automatically.

## Cloud Providers

### Azure OpenAI

```bash
export AZURE_OPENAI_AAIRIS_KEY=...
export AZURE_OPENAI_BASE_URL=https://your-resource.openai.azure.com
# also supported: https://your-resource.cognitiveservices.azure.com
# root endpoints are auto-normalized to /openai/v1
# or use resource name instead of base URL
export AZURE_OPENAI_RESOURCE_NAME=your-resource

# Optional
export AZURE_OPENAI_AAIRIS_VERSION=2024-02-01
export AZURE_OPENAI_DEPLOYMENT_NAME_MAP=gpt-4=my-gpt4,gpt-4o=my-gpt4o
```

### Amazon Bedrock

```bash
# Option 1: AWS Profile
export AWS_PROFILE=your-profile

# Option 2: IAM Keys
export AWS_ACCESS_KEY_ID=AKIA...
export AWS_SECRET_ACCESS_KEY=...

# Option 3: Bearer Token
export AWS_BEARER_TOKEN_BEDROCK=...

# Optional region (defaults to us-east-1)
export AWS_REGION=us-west-2
```

Also supports ECS task roles (`AWS_CONTAINER_CREDENTIALS_*`) and IRSA (`AWS_WEB_IDENTITY_TOKEN_FILE`).

```bash
airis --provider amazon-bedrock --model us.anthropic.claude-sonnet-4-20250514-v1:0
```

Prompt caching is enabled automatically for Claude models whose ID contains a recognizable model name (base models and system-defined inference profiles). For application inference profiles (whose ARNs don't contain the model name), set `AWS_BEDROCK_FORCE_CACHE=1` to enable cache points:

```bash
export AWS_BEDROCK_FORCE_CACHE=1
airis --provider amazon-bedrock --model arn:aws:bedrock:us-east-1:123456789012:application-inference-profile/abc123
```

If you are connecting to a Bedrock API proxy, the following environment variables can be used:

```bash
# Set the URL for the Bedrock proxy (standard AWS SDK env var)
export AWS_ENDPOINT_URL_BEDROCK_RUNTIME=https://my.corp.proxy/bedrock

# Set if your proxy does not require authentication
export AWS_BEDROCK_SKIP_AUTH=1

# Set if your proxy only supports HTTP/1.1
export AWS_BEDROCK_FORCE_HTTP1=1
```

### Cloudflare AI Gateway

`CLOUDFLARE_AAIRIS_KEY` can be set via `/login`. The account ID and gateway slug must be set as environment variables.

```bash
export CLOUDFLARE_AAIRIS_KEY=...           # or use /login
export CLOUDFLARE_ACCOUNT_ID=...
export CLOUDFLARE_GATEWAY_ID=...        # create at dash.cloudflare.com → AI → AI Gateway
airis --provider cloudflare-ai-gateway --model "claude-sonnet-4-5"
```

Routes to OpenAI, Anthropic, and Workers AI through Cloudflare AI Gateway. Workers AI uses the Unified API (`/compat`) and prefixed model IDs (`workers-ai/@cf/...`). OpenAI uses the OpenAI passthrough route (`/openai`) with native OpenAI model IDs such as `gpt-5.1`. Anthropic uses the Anthropic passthrough route (`/anthropic`) with native Anthropic model IDs such as `claude-sonnet-4-5`.

AI Gateway authentication uses `CLOUDFLARE_AAIRIS_KEY` as `cf-aig-authorization`. Upstream authentication can be one of:

| Mode | Request auth | Upstream auth |
|------|--------------|---------------|
| Workers AI | Cloudflare token only | Cloudflare-native |
| Unified billing | Cloudflare token only | Cloudflare handles upstream auth and deducts credits |
| Stored BYOK | Cloudflare token only | Cloudflare injects provider keys stored in the AI Gateway dashboard |
| Inline BYOK | Cloudflare token plus upstream `Authorization` header | The request supplies the upstream provider key |

For normal airis usage, prefer unified billing or stored BYOK. Inline BYOK requires configuring an additional upstream `Authorization` header for the Cloudflare AI Gateway provider, for example via a `models.json` provider/model override.

### Cloudflare Workers AI

`CLOUDFLARE_AAIRIS_KEY` can be set via `/login`. `CLOUDFLARE_ACCOUNT_ID` must be set as an environment variable.

```bash
export CLOUDFLARE_AAIRIS_KEY=...           # or use /login
export CLOUDFLARE_ACCOUNT_ID=...
airis --provider cloudflare-workers-ai --model "@cf/moonshotai/kimi-k2.6"
```

AIRIS automatically sets `x-session-affinity` for [prefix caching](https://developers.cloudflare.com/workers-ai/features/prompt-caching/) discounts.

### Google Vertex AI

Uses Application Default Credentials:

```bash
gcloud auth application-default login
export GOOGLE_CLOUD_PROJECT=your-project
export GOOGLE_CLOUD_LOCATION=us-central1
```

Or set `GOOGLE_APPLICATION_CREDENTIALS` to a service account key file.

## Custom Providers

**Via models.json:** Add Ollama, LM Studio, vLLM, or any provider that speaks a supported API (OpenAI Completions, OpenAI Responses, Anthropic Messages, Google Generative AI). See [models.md](models.md).

**Via extensions:** For providers that need custom API implementations or OAuth flows, create an extension. See [custom-provider.md](custom-provider.md) and [examples/extensions/custom-provider-gitlab-duo](../examples/extensions/custom-provider-gitlab-duo/).

## Resolution Order

When resolving credentials for a provider:

1. CLI `--aairis-key` flag
2. `auth.json` entry (API key or OAuth token)
3. Environment variable
4. Custom provider keys from `models.json`
