import { describe, expect, it } from "vitest";
import { parseResumeLocally } from "./local-resume-parser";

describe("local resume parser", () => {
  it("extracts common candidate fields from pasted resume text", () => {
    const result = parseResumeLocally(`
张三
手机：13800138000
邮箱：zhangsan@example.com
微信：zhangsan_hr
当前公司：某互联网科技有限公司
当前职位：HRBP
上海，6年工作经验
本科 / 人力资源管理
负责组织发展、绩效管理、招聘协同和员工关系。
`);

    expect(result.name).toBe("张三");
    expect(result.phone).toBe("13800138000");
    expect(result.email).toBe("zhangsan@example.com");
    expect(result.wechat).toBe("zhangsan_hr");
    expect(result.currentTitle).toBe("HRBP");
    expect(result.currentCompanyName).toContain("某互联网科技有限公司");
    expect(result.city).toBe("上海");
    expect(result.yearsOfExperience).toBe(6);
    expect(result.tags).toContain("HRBP");
    expect(result.resumeText).toContain("组织发展");
  });

  it("falls back to role keywords when no explicit title label exists", () => {
    const result = parseResumeLocally("李四\n8年Java后端研发经验，熟悉Spring、MySQL、Redis。\n北京");

    expect(result.name).toBe("李四");
    expect(result.currentTitle).toBe("后端工程师");
    expect(result.tags).toContain("后端");
    expect(result.city).toBe("北京");
  });
});
