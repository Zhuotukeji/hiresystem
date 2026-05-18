import { ResumeParseResult } from "@hiresystem/shared";

const CITY_KEYWORDS = [
  "北京",
  "上海",
  "广州",
  "深圳",
  "杭州",
  "成都",
  "武汉",
  "南京",
  "苏州",
  "西安",
  "重庆",
  "天津",
  "长沙",
  "郑州",
  "合肥",
  "厦门",
  "青岛",
  "宁波",
  "佛山",
  "东莞"
];

const ROLE_KEYWORDS: Array<{ title: string; patterns: RegExp[]; tags: string[] }> = [
  { title: "HRBP", patterns: [/HRBP/i, /人力资源业务伙伴/, /人力资源BP/i, /组织发展/, /\bOD\b/i], tags: ["HRBP", "组织发展"] },
  { title: "产品经理", patterns: [/产品经理/, /\bPM\b/i, /产品负责人/], tags: ["产品经理"] },
  { title: "后端工程师", patterns: [/后端/, /服务端/, /\bJava\b/i, /\bGolang\b/i, /\bGo\b/, /\bPython\b/i], tags: ["后端"] },
  { title: "前端工程师", patterns: [/前端/, /\bReact\b/i, /\bVue\b/i, /\bTypeScript\b/i], tags: ["前端"] },
  { title: "测试工程师", patterns: [/测试/, /\bQA\b/i, /质量保障/], tags: ["测试"] },
  { title: "运营", patterns: [/运营/, /用户增长/, /内容运营/, /活动运营/], tags: ["运营"] },
  { title: "销售", patterns: [/销售/, /商务/, /\bBD\b/i, /客户经理/], tags: ["销售"] },
  { title: "设计师", patterns: [/设计师/, /\bUI\b/i, /\bUX\b/i, /视觉设计/], tags: ["设计"] }
];

const SKILL_TAGS = [
  "HRBP",
  "组织发展",
  "绩效管理",
  "招聘",
  "薪酬",
  "员工关系",
  "Java",
  "Golang",
  "Go",
  "Python",
  "React",
  "Vue",
  "TypeScript",
  "Node.js",
  "Spring",
  "MySQL",
  "PostgreSQL",
  "Redis",
  "Kubernetes",
  "Docker",
  "SaaS",
  "B2B",
  "增长",
  "数据分析",
  "项目管理"
];

export function parseResumeLocally(resumeText: string): ResumeParseResult {
  const normalized = normalizeText(resumeText);
  const lines = normalized
    .split("\n")
    .map((line) => cleanLine(line))
    .filter((line) => line && !isNoiseLine(line))
    .slice(0, 120);

  const phone = extractPhone(normalized);
  const email = extractEmail(normalized);
  const wechat = extractLabeledValue(lines, ["微信", "wechat", "weixin"]);
  const name = extractName(lines, phone, email);
  const roleMatch = extractRole(normalized, lines);
  const currentCompanyName = extractCompany(lines);
  const city = extractCity(normalized);
  const yearsOfExperience = extractYears(normalized);
  const educationSummary = extractEducation(lines);
  const expectedSalary = extractSalary(lines, ["期望薪资", "期望"]);
  const currentSalary = extractSalary(lines, ["当前薪资", "目前薪资", "薪资"]);
  const availability = extractLabeledValue(lines, ["到岗", "到岗时间", "离职状态"]);
  const jobIntention = extractLabeledValue(lines, ["求职意向", "意向岗位", "期望岗位"]);
  const tags = buildTags(normalized, roleMatch.tags, city);

  return {
    name,
    phone,
    email,
    wechat,
    currentCompanyName,
    currentTitle: roleMatch.title,
    currentLevel: "",
    city,
    yearsOfExperience,
    educationSummary,
    expectedSalary,
    currentSalary,
    availability,
    jobIntention,
    sourceChannel: "简历上传",
    tags,
    aiSummary: buildSummary({ role: roleMatch.title, yearsOfExperience, currentCompanyName, city, tags }),
    resumeText: normalized
  };
}

function normalizeText(value: string) {
  return value
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\b[A-Za-z0-9]{24,}\b/g, (token) => (isOpaqueToken(token) ? "" : token))
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanLine(line: string) {
  return line.replace(/[｜|]/g, " ").replace(/\s+/g, " ").trim();
}

function extractPhone(text: string) {
  const match = text.match(/(?:\+?86[-\s]?)?(1[3-9]\d[-\s]?\d{4}[-\s]?\d{4})/);
  return match ? match[1].replace(/\D/g, "") : "";
}

function extractEmail(text: string) {
  return text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? "";
}

function extractName(lines: string[], phone: string, email: string) {
  for (const line of lines.slice(0, 20)) {
    const labeled = line.match(/(?:姓名|名字)[:：\s]+([\u4e00-\u9fa5A-Za-z·.\s]{2,30})/);
    const candidate = sanitizeFieldValue(labeled?.[1], 30);
    if (candidate && isPlausibleName(candidate)) return candidate;
  }

  for (const line of lines.slice(0, 12)) {
    const compact = line.replace(/\s+/g, "");
    if (!compact || (phone && compact.includes(phone)) || (email && compact.includes(email))) continue;
    if (isNoiseLine(compact)) continue;
    if (/简历|电话|手机|邮箱|微信|求职|应聘|岗位|职位|工作|项目|教育|经验|公司|大学|本科|硕士|博士/i.test(compact)) continue;
    if (/^[\u4e00-\u9fa5·]{2,6}$/.test(compact)) return compact;
    if (/^[A-Za-z][A-Za-z\s·.-]{1,35}$/.test(line) && !/resume|profile|candidate|email|phone/i.test(line)) return line.trim();
  }

  return "";
}

function extractRole(text: string, lines: string[]) {
  const labeled = extractLabeledValue(lines, ["当前职位", "目前职位", "职位", "岗位", "应聘岗位", "求职意向"]);
  for (const role of ROLE_KEYWORDS) {
    if (labeled && role.patterns.some((pattern) => pattern.test(labeled))) {
      return { title: role.title, tags: role.tags };
    }
  }
  for (const role of ROLE_KEYWORDS) {
    if (role.patterns.some((pattern) => pattern.test(text))) {
      return { title: role.title, tags: role.tags };
    }
  }
  const fallbackTitle = sanitizeFieldValue(labeled, 40);
  return { title: fallbackTitle, tags: fallbackTitle ? [fallbackTitle.slice(0, 20)] : [] };
}

function extractCompany(lines: string[]) {
  const labeled = extractLabeledValue(lines, ["当前公司", "最近公司", "公司"]);
  if (labeled) return stripCompanyNoise(labeled);

  const companyLine = lines.find(
    (line) =>
      /(公司|集团|科技|网络|信息|股份|有限|互联网|软件)/.test(line) &&
      !/(项目|职责|描述|邮箱|电话|手机|教育|学校|大学)/.test(line) &&
      line.length <= 80
  );
  return companyLine ? stripCompanyNoise(companyLine) : "";
}

function stripCompanyNoise(value: string) {
  const cleaned = value
    .replace(/^\d{4}[./-]\d{1,2}\s*(?:[-~至到]\s*(?:今|至今|\d{4}[./-]\d{1,2})?)?\s*/, "")
    .replace(/(?:职位|岗位|担任|任职).*/, "")
    .replace(/[，,；;].*$/, "")
    .trim();
  const companyMatch = cleaned.match(
    /([\u4e00-\u9fa5A-Za-z0-9（）()·.&-]{2,70}(?:股份有限公司|有限责任公司|有限公司|集团|公司|科技|网络|信息|软件))/
  );
  return sanitizeFieldValue(companyMatch?.[1] ?? cleaned, 60);
}

function extractCity(text: string) {
  return CITY_KEYWORDS.find((city) => text.includes(city)) ?? "";
}

function extractYears(text: string) {
  const patterns = [
    /(?:工作年限|工作经验|经验)[:：\s]*(\d{1,2})\s*年/,
    /(\d{1,2})\s*年(?:以上)?(?:工作)?经验/,
    /(\d{1,2})\s*years?/i
  ];
  for (const pattern of patterns) {
    const value = pattern.exec(text)?.[1];
    if (value) return Number.parseInt(value, 10);
  }
  return null;
}

function extractEducation(lines: string[]) {
  const line = lines.find((item) => /(博士|硕士|研究生|本科|大专|大学|学院|MBA)/.test(item));
  return sanitizeFieldValue(line, 80);
}

function extractSalary(lines: string[], labels: string[]) {
  const labeled = extractLabeledValue(lines, labels);
  if (labeled && /\d|k|K|万|薪/.test(labeled)) return labeled.slice(0, 40);

  const salaryLine = lines.find((line) => /\d+\s*[kK]|年薪|月薪|\d+\s*万/.test(line));
  return sanitizeFieldValue(salaryLine, 40);
}

function extractLabeledValue(lines: string[], labels: string[]) {
  const labelPattern = labels.map(escapeRegExp).join("|");
  const pattern = new RegExp(`(?:^|[\\s,，;；|｜])(?:${labelPattern})\\s*[:：]?\\s*(.+)`, "i");
  for (const line of lines) {
    const match = line.match(pattern);
    const value = sanitizeFieldValue(match?.[1], 100);
    if (value) return value;
  }
  return "";
}

function buildTags(text: string, roleTags: string[], city: string) {
  const tags = new Set<string>();
  for (const tag of roleTags) tags.add(tag);
  for (const tag of SKILL_TAGS) {
    if (new RegExp(escapeRegExp(tag), "i").test(text)) tags.add(tag);
  }
  if (city) tags.add(city);
  return Array.from(tags).filter(Boolean).slice(0, 8);
}

function buildSummary(params: {
  role: string;
  yearsOfExperience: number | null;
  currentCompanyName: string;
  city: string;
  tags: string[];
}) {
  const parts = [
    params.role ? `可能岗位：${params.role}` : "",
    params.yearsOfExperience !== null ? `${params.yearsOfExperience}年经验` : "",
    params.currentCompanyName ? `当前/最近公司：${params.currentCompanyName}` : "",
    params.city ? `城市：${params.city}` : "",
    params.tags.length ? `标签：${params.tags.slice(0, 5).join("、")}` : ""
  ].filter(Boolean);
  return parts.length ? `本地快速识别：${parts.join("；")}。请HR确认后保存。` : "本地快速识别完成，请HR补充并确认候选人信息。";
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sanitizeFieldValue(value: string | undefined, maxLength: number) {
  const cleaned = (value ?? "")
    .replace(/\b[A-Za-z0-9]{24,}\b/g, (token) => (isOpaqueToken(token) ? "" : token))
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned || isNoiseLine(cleaned)) return "";
  return cleaned.slice(0, maxLength).trim();
}

function isPlausibleName(value: string) {
  const compact = value.replace(/\s+/g, "");
  if (isNoiseLine(compact)) return false;
  return /^[\u4e00-\u9fa5·]{2,8}$/.test(compact) || /^[A-Za-z][A-Za-z\s·.-]{1,35}$/.test(value);
}

function isNoiseLine(value: string) {
  const compact = value.replace(/[\s:：,，;；|｜._-]/g, "");
  if (!compact) return true;
  if (isOpaqueToken(compact)) return true;
  const asciiChars = compact.match(/[A-Za-z0-9]/g)?.length ?? 0;
  const chineseChars = compact.match(/[\u4e00-\u9fa5]/g)?.length ?? 0;
  if (compact.length >= 24 && chineseChars === 0 && asciiChars / compact.length > 0.85) return true;
  return false;
}

function isOpaqueToken(token: string) {
  if (token.length < 24) return false;
  const hasDigit = /\d/.test(token);
  const hasLower = /[a-z]/.test(token);
  const hasUpper = /[A-Z]/.test(token);
  const isHexLike = /^[a-f0-9]{24,}$/i.test(token);
  return isHexLike || (hasDigit && hasLower && hasUpper);
}
