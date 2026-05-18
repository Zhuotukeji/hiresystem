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

  it("removes opaque watermark tokens from extracted resume text", async () => {
    const token = "ca02b7bad64ceed11HB63N24FFVQx466VfyZWOCrmfbVMhVk";
    const text = await extractResumeText(undefined, `王五\n${token}\nHRBP`);

    expect(text).toContain("王五");
    expect(text).toContain("HRBP");
    expect(text).not.toContain(token);
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
