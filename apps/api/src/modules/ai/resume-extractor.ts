import { BadRequestException } from "@nestjs/common";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";

export type ResumeUploadFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

const MAX_TEXT_LENGTH = 80_000;

export async function extractResumeText(file?: ResumeUploadFile, fallbackText?: string) {
  const pastedText = normalizeText(fallbackText);
  if (!file) {
    if (!pastedText) {
      throw new BadRequestException("请上传 PDF/DOCX/TXT 简历，或粘贴简历文本");
    }
    return pastedText;
  }

  const extension = getExtension(file.originalname);
  let text = "";
  if (file.mimetype === "text/plain" || extension === "txt") {
    text = file.buffer.toString("utf8");
  } else if (file.mimetype === "application/pdf" || extension === "pdf") {
    const result = await pdfParse(file.buffer);
    text = result.text;
  } else if (
    file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    extension === "docx"
  ) {
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    text = result.value;
  } else {
    throw new BadRequestException("仅支持 PDF、DOCX、TXT 格式的简历");
  }

  const extractedText = normalizeText(text);
  const resumeText = extractedText || pastedText;
  if (!resumeText) {
    throw new BadRequestException("简历内容为空，无法识别");
  }
  return resumeText.slice(0, MAX_TEXT_LENGTH);
}

function normalizeText(value?: string) {
  return (value ?? "")
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getExtension(filename: string) {
  const match = /\.([^.]+)$/.exec(filename.toLowerCase());
  return match?.[1] ?? "";
}
