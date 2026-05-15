import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { extractResumeText } from "./resume-extractor";

describe("resume extractor", () => {
  it("extracts text from txt upload", async () => {
    const text = await extractResumeText({
      buffer: Buffer.from("张三\n6年 HRBP 经验", "utf8"),
      mimetype: "text/plain",
      originalname: "resume.txt",
      size: 24
    });

    expect(text).toContain("HRBP");
  });

  it("uses pasted text when no file is uploaded", async () => {
    await expect(extractResumeText(undefined, "李四，前端工程师")).resolves.toContain("前端工程师");
  });

  it("rejects unsupported formats", async () => {
    await expect(
      extractResumeText({
        buffer: Buffer.from("x"),
        mimetype: "image/png",
        originalname: "resume.png",
        size: 1
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
