import { describe, expect, it } from "vitest";
import { pipelineStages, stageLabel, stageToKitStage } from "./stages";

describe("stage helpers", () => {
  it("maps pipeline stages to AI interview kit stages", () => {
    expect(stageToKitStage("FIRST_INTERVIEW")).toBe("first_interview");
    expect(stageToKitStage("SECOND_INTERVIEW")).toBe("second_interview");
    expect(stageToKitStage("FINAL_INTERVIEW")).toBe("final_interview");
    expect(stageToKitStage("HR_SCREEN")).toBe("hr_screen");
  });

  it("keeps manager review as a pipeline stage", () => {
    expect(pipelineStages).toContain("MANAGER_REVIEW");
  });

  it("renders Chinese labels for pipeline stages", () => {
    expect(stageLabel("NEW")).toBe("新候选人");
    expect(stageLabel("HR_SCREEN")).toBe("HR 初筛");
    expect(stageLabel("FIRST_INTERVIEW")).toBe("一面");
  });
});
