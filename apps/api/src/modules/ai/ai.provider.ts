import { Injectable, ServiceUnavailableException } from "@nestjs/common";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

const DEFAULT_SUB2API_MODEL = "gpt-5.5";
const PLACEHOLDER_API_KEYS = new Set(["replace-with-server-secret", "<server-secret>", "your-api-key", "your-sub2api-api-key"]);
const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_MAX_RETRIES = 1;
const DEFAULT_REASONING_EFFORT = "low";
const SUPPORTED_REASONING_EFFORTS = new Set(["none", "minimal", "low", "medium", "high", "xhigh"]);

@Injectable()
export class AiProvider {
  private get baseUrl() {
    return (process.env.SUB2API_BASE_URL ?? "https://ai.midongtech.com/v1").replace(/\/$/, "");
  }

  private get apiKey() {
    return process.env.SUB2API_API_KEY?.trim();
  }

  get model() {
    return process.env.SUB2API_MODEL?.trim() || DEFAULT_SUB2API_MODEL;
  }

  get configStatus() {
    return {
      baseUrl: this.baseUrl,
      model: this.model,
      apiKey: this.apiKeyStatus(),
      reasoningEffort: this.reasoningEffort,
      timeoutMs: this.timeoutMs,
      maxRetries: this.maxRetries
    };
  }

  async completeJson(messages: ChatMessage[]) {
    const apiKeyStatus = this.apiKeyStatus();
    if (apiKeyStatus !== "configured") {
      throw new ServiceUnavailableException(
        "SUB2API_API_KEY is missing or still a placeholder. Set the real key in the server .env file and recreate the api container."
      );
    }

    let response: Response | undefined;
    let lastNetworkError: unknown;
    for (let attempt = 1; attempt <= this.maxRetries; attempt += 1) {
      try {
        response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`
          },
          body: JSON.stringify({
            model: this.model,
            messages,
            temperature: 0.2,
            reasoning_effort: this.reasoningEffort,
            response_format: { type: "json_object" }
          }),
          signal: AbortSignal.timeout(this.timeoutMs)
        });

        if (response.status >= 500 && attempt < this.maxRetries) {
          await response.text().catch(() => "");
          await this.sleep(attempt * 500);
          continue;
        }
        break;
      } catch (error) {
        lastNetworkError = error;
        if (attempt < this.maxRetries) {
          await this.sleep(attempt * 500);
          continue;
        }
      }
    }

    if (!response) {
      if (this.isTimeoutError(lastNetworkError)) {
        throw new ServiceUnavailableException(
          `AI request timed out after ${this.timeoutMs}ms. Increase SUB2API_TIMEOUT_MS or use async evaluation mode for long-running tasks.`
        );
      }
      throw new ServiceUnavailableException(`AI service is unreachable after retries: ${this.formatError(lastNetworkError)}`);
    }

    if (!response.ok) {
      const text = await response.text();
      if (response.status === 401 || response.status === 403) {
        throw new ServiceUnavailableException(
          `AI request rejected (${response.status}). SUB2API_API_KEY is invalid or not authorized for model ${this.model}. Update the server .env file, then recreate the api container.`
        );
      }
      throw new ServiceUnavailableException(`AI request failed: ${response.status} ${this.compact(text)}`);
    }

    const payload = await response.json();
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new ServiceUnavailableException("AI response has no content");
    }

    return {
      data: this.parseJson(content),
      usage: payload.usage
    };
  }

  private parseJson(content: string) {
    const cleaned = content
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "");
    try {
      return JSON.parse(cleaned);
    } catch {
      const first = cleaned.indexOf("{");
      const last = cleaned.lastIndexOf("}");
      if (first >= 0 && last > first) {
        return JSON.parse(cleaned.slice(first, last + 1));
      }
      throw new ServiceUnavailableException("AI response is not valid JSON");
    }
  }

  private formatError(error: unknown) {
    if (error instanceof Error) {
      return error.cause instanceof Error ? `${error.message}: ${error.cause.message}` : error.message;
    }
    return String(error);
  }

  private compact(text: string) {
    return text.replace(/\s+/g, " ").trim().slice(0, 800);
  }

  private apiKeyStatus() {
    const apiKey = this.apiKey;
    if (!apiKey) return "missing";
    if (PLACEHOLDER_API_KEYS.has(apiKey) || /^replace-|^change-|^your-/i.test(apiKey)) return "placeholder";
    return "configured";
  }

  private get timeoutMs() {
    return this.readNumberEnv("SUB2API_TIMEOUT_MS", DEFAULT_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, 300_000);
  }

  private get maxRetries() {
    return this.readNumberEnv("SUB2API_MAX_RETRIES", DEFAULT_MAX_RETRIES, 1, 3);
  }

  private get reasoningEffort() {
    const raw = process.env.SUB2API_REASONING_EFFORT?.trim().toLowerCase();
    if (!raw) return DEFAULT_REASONING_EFFORT;
    return SUPPORTED_REASONING_EFFORTS.has(raw) ? raw : DEFAULT_REASONING_EFFORT;
  }

  private readNumberEnv(name: string, fallback: number, min: number, max: number) {
    const raw = process.env[name];
    if (!raw) return fallback;
    const value = Number.parseInt(raw, 10);
    if (Number.isNaN(value)) return fallback;
    return Math.min(max, Math.max(min, value));
  }

  private isTimeoutError(error: unknown) {
    return error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name);
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
