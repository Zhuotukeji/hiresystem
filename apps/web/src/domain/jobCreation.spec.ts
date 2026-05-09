import { describe, expect, it } from "vitest";
import { getJobCreationConfirmCopy } from "./jobCreation";

describe("job creation helpers", () => {
  it("builds manual creation confirmation copy", () => {
    expect(getJobCreationConfirmCopy("manual", "后端工程师")).toMatchObject({
      title: "确认创建岗位？",
      content: "确认后将创建「后端工程师」岗位。"
    });
  });

  it("builds AI creation confirmation copy before draft creation", () => {
    const copy = getJobCreationConfirmCopy("ai", "算法工程师");

    expect(copy.title).toBe("确认创建岗位并生成 JD？");
    expect(copy.content).toContain("先创建「算法工程师」岗位草稿");
  });
});
