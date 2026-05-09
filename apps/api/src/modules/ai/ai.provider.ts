import { Injectable, ServiceUnavailableException } from "@nestjs/common";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

@Injectable()
export class AiProvider {
  private get baseUrl() {
    return (process.env.SUB2API_BASE_URL ?? "https://ai.midongtech.com/v1").replace(/\/$/, "");
  }

  private get apiKey() {
    return process.env.SUB2API_API_KEY;
  }

  get model() {
    return process.env.SUB2API_MODEL ?? "gpt-4o-mini";
  }

  async completeJson(messages: ChatMessage[]) {
    if (!this.apiKey) {
      throw new ServiceUnavailableException("SUB2API_API_KEY is not configured");
    }

    let response: Response | undefined;
    let lastNetworkError: unknown;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
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
            response_format: { type: "json_object" }
          }),
          signal: AbortSignal.timeout(70_000)
        });

        if (response.status >= 500 && attempt < 3) {
          await response.text().catch(() => "");
          await this.sleep(attempt * 800);
          continue;
        }
        break;
      } catch (error) {
        lastNetworkError = error;
        if (attempt < 3) {
          await this.sleep(attempt * 800);
          continue;
        }
      }
    }

    if (!response) {
      throw new ServiceUnavailableException(`AI service is unreachable after retries: ${this.formatError(lastNetworkError)}`);
    }

    if (!response.ok) {
      const text = await response.text();
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

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
