import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { CurrentUser, RequestUser } from "../../common/current-user.decorator";
import { ApplicationsService } from "./applications.service";
import { CreateApplicationDto, UpdateApplicationDto } from "./applications.dto";

@Controller("applications")
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Get()
  findMany(@Query() query: Record<string, string>) {
    return this.applicationsService.findMany(query);
  }

  @Post()
  create(@Body() dto: CreateApplicationDto) {
    return this.applicationsService.create(dto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateApplicationDto) {
    return this.applicationsService.update(id, dto);
  }

  @Post(":id/stage-handoff")
  createStageHandoff(@Param("id") id: string, @Body() body: { toStage?: string }, @CurrentUser() user: RequestUser) {
    return this.applicationsService.createStageHandoff(id, body.toStage, user?.sub);
  }
}
