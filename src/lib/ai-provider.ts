/**
 * Provider-agnostic AI completion layer.
 *
 * Supports Anthropic Claude and OpenAI GPT models.
 * Provider is selected via the AI_PROVIDER env var (default: "claude").
 * Falls back to whichever API key is present if AI_PROVIDER is not set.
 *
 * Prompt compatibility notes:
 * - All expert prompts instruct the model to "Return ONLY valid JSON".
 * - For OpenAI, json mode (response_format: { type: "json_object" }) is always
 *   enabled — this guarantees raw JSON output and removes the need for code-fence
 *   stripping. Requires gpt-4o, gpt-4o-mini, or gpt-4-turbo (not legacy gpt-4/gpt-3.5).
 * - For Claude, the prompts work as-is; the parseJsonResponse helper in route.ts
 *   strips any stray code fences as a defensive fallback.
 * - No prompt rewriting is needed when switching providers — both honour the same
 *   structured JSON output instructions.
 */

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

export type Provider = "claude" | "openai";

export interface CompletionOptions {
  maxTokens?: number;
}

function resolveProvider(): Provider {
  const explicit = process.env.AI_PROVIDER?.toLowerCase();
  if (explicit === "openai") return "openai";
  if (explicit === "claude") return "claude";
  // Auto-detect from available keys: prefer Claude
  if (process.env.ANTHROPIC_API_KEY) return "claude";
  if (process.env.OPENAI_API_KEY) return "openai";
  return "claude"; // will fail at call-time with a clear error
}

export function getProvider(): Provider {
  return resolveProvider();
}

export async function complete(
  prompt: string,
  options: CompletionOptions = {}
): Promise<string> {
  const { maxTokens = 1024 } = options;
  const provider = resolveProvider();

  if (provider === "openai") {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
    const model = process.env.OPENAI_MODEL ?? "gpt-4o";
    const client = new OpenAI({ apiKey });
    try {
      const response = await client.chat.completions.create({
        model,
        max_tokens: maxTokens,
        // JSON mode guarantees raw JSON output — no markdown fences, no prose.
        // All expert prompts already mention "JSON" which is required by the API.
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: prompt }],
      });
      return response.choices[0]?.message?.content ?? "";
    } catch (err) {
      if (err instanceof OpenAI.AuthenticationError) {
        throw new Error("AI service is temporarily unavailable. Please try again later.");
      }
      throw err;
    }
  }

  // Default: Claude
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");
  const model = process.env.CLAUDE_MODEL ?? "claude-sonnet-4-6";
  const client = new Anthropic({ apiKey });
  try {
    const message = await client.messages.create({
      model,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    });
    return message.content[0].type === "text" ? message.content[0].text : "";
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      throw new Error("AI service is temporarily unavailable. Please try again later.");
    }
    throw err;
  }
}
