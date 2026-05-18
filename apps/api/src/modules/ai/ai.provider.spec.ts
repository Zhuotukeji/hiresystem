import { afterEach, describe, expect, it, vi } from "vitest";
import { AiProvider } from "./ai.provider";

describe("AiProvider", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  it("falls back when the configured reasoning effort is not supported by the model", async () => {
    process.env.SUB2API_API_KEY = "test-key";
    process.env.SUB2API_BASE_URL = "https://example.test/v1";
    process.env.SUB2API_MODEL = "gpt-5.4";
    process.env.SUB2API_REASONING_EFFORT = "minimal";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              message:
                "Unsupported value: 'minimal' is not supported with the 'gpt-5.4' model. Supported values are: 'none', 'low', 'medium'."
            }
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "{\"ok\":true}" } }],
            usage: { prompt_tokens: 1, completion_tokens: 1 }
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await new AiProvider().completeJson([{ role: "user", content: "hi" }]);

    expect(result.data).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string).reasoning_effort).toBe("minimal");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body as string).reasoning_effort).toBe("none");
  });

  it("retries transient upstream 502 responses before failing the request", async () => {
    process.env.SUB2API_API_KEY = "test-key";
    process.env.SUB2API_BASE_URL = "https://example.test/v1";
    delete process.env.SUB2API_MAX_RETRIES;

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("bad gateway", { status: 502 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "{\"ok\":true}" } }]
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await new AiProvider().completeJson([{ role: "user", content: "hi" }]);

    expect(result.data).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries without reasoning_effort when the gateway keeps returning 5xx", async () => {
    process.env.SUB2API_API_KEY = "test-key";
    process.env.SUB2API_BASE_URL = "https://example.test/v1";
    process.env.SUB2API_MAX_RETRIES = "1";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("bad gateway", { status: 502 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "{\"ok\":true}" } }]
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await new AiProvider().completeJson([{ role: "user", content: "hi" }]);

    expect(result.data).toEqual({ ok: true });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string).reasoning_effort).toBe("none");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body as string).reasoning_effort).toBeUndefined();
  });
});
