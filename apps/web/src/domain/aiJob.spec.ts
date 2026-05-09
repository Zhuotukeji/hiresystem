import { describe, expect, it } from "vitest";
import { buildDraftJobPayload, canStartAiJobGeneration, formatJdPreview } from "./aiJob";

describe("AI job helpers", () => {
  it("requires a non-empty prompt before starting AI JD generation", () => {
    expect(canStartAiJobGeneration({ prompt: "" })).toBe(false);
    expect(canStartAiJobGeneration({ prompt: "   " })).toBe(false);
    expect(canStartAiJobGeneration({ prompt: "招聘高级后端", isPending: true })).toBe(false);
    expect(canStartAiJobGeneration({ prompt: "招聘高级后端" })).toBe(true);
  });

  it("builds a minimal draft job payload before calling AI", () => {
    expect(buildDraftJobPayload({ title: "高级后端", priority: "P0" }, "负责订单系统")).toMatchObject({
      title: "高级后端",
      priority: "P0",
      headcount: 1,
      jd: "负责订单系统"
    });
  });

  it("formats AI JD result for preview", () => {
    const text = formatJdPreview({
      job_title: "高级后端",
      external_jd: {
        title: "高级后端",
        job_description: ["负责订单系统"],
        requirements: ["Java经验"],
        nice_to_have: ["交易系统经验"],
        company_pitch: "参与核心链路建设"
      }
    });
    expect(text).toContain("## 岗位职责");
    expect(text).toContain("Java经验");
  });
});
