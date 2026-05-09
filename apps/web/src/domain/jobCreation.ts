export type JobCreationMode = "manual" | "ai";

export function getJobCreationConfirmCopy(mode: JobCreationMode, title?: string) {
  const jobTitle = title?.trim() || "未命名岗位";
  return {
    title: mode === "ai" ? "确认创建岗位并生成 JD？" : "确认创建岗位？",
    content:
      mode === "ai"
        ? `系统会先创建「${jobTitle}」岗位草稿，再调用 AI 生成 JD 和岗位画像。`
        : `确认后将创建「${jobTitle}」岗位。`
  };
}
