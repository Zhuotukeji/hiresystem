import { PrismaClient, UserRole } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Admin123!", 10);

  await prisma.user.upsert({
    where: { email: "admin@hiresystem.local" },
    update: {},
    create: {
      name: "系统管理员",
      email: "admin@hiresystem.local",
      passwordHash,
      role: UserRole.ADMIN
    }
  });

  await prisma.user.upsert({
    where: { email: "hr@hiresystem.local" },
    update: {},
    create: {
      name: "招聘负责人",
      email: "hr@hiresystem.local",
      passwordHash,
      role: UserRole.HR_LEAD
    }
  });

  const company = await prisma.targetCompany.upsert({
    where: { name: "示例电商公司" },
    update: {},
    create: {
      name: "示例电商公司",
      companyType: "benchmark",
      industry: "电商",
      city: "上海",
      talentQualityLevel: "A",
      sourcingPriority: "P0",
      businessTags: ["交易系统", "库存", "履约"],
      techTags: ["Java", "Redis", "Kafka"],
      targetRoles: ["后端工程师", "架构师"]
    }
  });

  await prisma.candidate.createMany({
    data: [
      {
        name: "张三",
        currentCompanyId: company.id,
        currentCompanyName: company.name,
        currentTitle: "高级后端工程师",
        city: "上海",
        yearsOfExperience: 5,
        sourceChannel: "target_mapping",
        tags: ["Java", "交易系统", "目标公司"],
        resumeText:
          "5年Java后端经验，负责订单中心重构、库存同步和履约链路稳定性治理。技术栈包含Spring Boot、MySQL、Redis、Kafka。"
      }
    ],
    skipDuplicates: true
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
