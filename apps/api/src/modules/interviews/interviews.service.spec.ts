import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { InterviewsService } from "./interviews.service";

describe("InterviewsService", () => {
  it("requires an active interviewer when creating an interview workspace", async () => {
    const prisma = createPrismaMock();
    const service = new InterviewsService(prisma as never);

    await expect(
      service.create({
        applicationId: "application-1",
        interviewRound: "first_interview",
        interviewerId: ""
      })
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.application.findUnique).not.toHaveBeenCalled();
  });

  it("creates an interview assigned to the selected interviewer", async () => {
    const prisma = createPrismaMock();
    const service = new InterviewsService(prisma as never);

    await service.create({
      applicationId: "application-1",
      interviewRound: "first_interview",
      interviewerId: "user-1"
    });

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { id: "user-1", isActive: true },
      select: { id: true }
    });
    expect(prisma.interview.create).toHaveBeenCalledWith({
      data: {
        applicationId: "application-1",
        candidateId: "candidate-1",
        jobId: "job-1",
        interviewRound: "first_interview",
        interviewerId: "user-1",
        scheduledAt: undefined
      }
    });
  });

  it("returns only the current interviewer's scheduled tasks", async () => {
    const prisma = createPrismaMock();
    const service = new InterviewsService(prisma as never);

    const tasks = await service.myTasks("user-1");

    expect(prisma.interview.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { interviewerId: "user-1", status: "SCHEDULED" }
      })
    );
    expect(tasks).toEqual([
      expect.objectContaining({
        interviewId: "interview-2",
        candidateName: "李四",
        jobTitle: "HRBP",
        interviewRound: "second_interview",
        status: "SCHEDULED",
        hasFeedback: false
      }),
      expect.objectContaining({
        interviewId: "interview-1",
        candidateName: "张三",
        jobTitle: "后端工程师",
        interviewRound: "first_interview",
        status: "SCHEDULED",
        hasFeedback: true
      })
    ]);
  });

  it("returns active users as interviewer options without sensitive fields", async () => {
    const prisma = createPrismaMock();
    const service = new InterviewsService(prisma as never);

    await service.interviewers();

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      select: { id: true, name: true, email: true, role: true },
      orderBy: [{ role: "asc" }, { name: "asc" }]
    });
  });
});

function createPrismaMock() {
  return {
    application: {
      findUnique: vi.fn().mockResolvedValue({
        id: "application-1",
        candidateId: "candidate-1",
        jobId: "job-1"
      })
    },
    user: {
      findFirst: vi.fn().mockResolvedValue({ id: "user-1" }),
      findMany: vi.fn().mockResolvedValue([])
    },
    interview: {
      create: vi.fn().mockResolvedValue({ id: "interview-1" }),
      findMany: vi.fn().mockResolvedValue([
        {
          id: "interview-1",
          candidateId: "candidate-1",
          jobId: "job-1",
          interviewRound: "first_interview",
          status: "SCHEDULED",
          scheduledAt: new Date("2026-05-20T09:00:00.000Z"),
          createdAt: new Date("2026-05-19T01:00:00.000Z"),
          candidate: {
            id: "candidate-1",
            name: "张三",
            currentCompanyName: "A公司",
            currentTitle: "后端工程师"
          },
          job: { id: "job-1", title: "后端工程师", department: "技术部" },
          feedback: { id: "feedback-1" }
        },
        {
          id: "interview-2",
          candidateId: "candidate-2",
          jobId: "job-2",
          interviewRound: "second_interview",
          status: "SCHEDULED",
          scheduledAt: new Date("2026-05-20T08:00:00.000Z"),
          createdAt: new Date("2026-05-19T02:00:00.000Z"),
          candidate: {
            id: "candidate-2",
            name: "李四",
            currentCompanyName: "B公司",
            currentTitle: "HRBP"
          },
          job: { id: "job-2", title: "HRBP", department: "人力资源部" },
          feedback: null
        }
      ])
    }
  };
}
