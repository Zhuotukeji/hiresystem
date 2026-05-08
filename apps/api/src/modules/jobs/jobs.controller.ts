import { Body, Controller, Get, Param, Patch, Post, Put, Query } from "@nestjs/common";
import { CurrentUser, RequestUser } from "../../common/current-user.decorator";
import { CreateJobDto, JobProfileDto, UpdateJobDto } from "./jobs.dto";
import { JobsService } from "./jobs.service";

@Controller("jobs")
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get()
  findMany(@Query() query: Record<string, string>) {
    return this.jobsService.findMany(query);
  }

  @Get("dashboard/stats")
  dashboardStats() {
    return this.jobsService.dashboardStats();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.jobsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateJobDto, @CurrentUser() user: RequestUser) {
    return this.jobsService.create(dto, user?.sub);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateJobDto) {
    return this.jobsService.update(id, dto);
  }

  @Put(":id/profile")
  upsertProfile(@Param("id") id: string, @Body() dto: JobProfileDto, @CurrentUser() user: RequestUser) {
    return this.jobsService.upsertProfile(id, dto, user?.sub);
  }
}
