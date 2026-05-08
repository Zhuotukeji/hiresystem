import { describe, expect, it } from "vitest";
import { pipelineStages, stageToKitStage } from "./stages";

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
});
