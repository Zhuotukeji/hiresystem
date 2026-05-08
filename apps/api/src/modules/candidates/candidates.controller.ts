import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { CurrentUser, RequestUser } from "../../common/current-user.decorator";
import { CreateCandidateDto, UpdateCandidateDto } from "./candidates.dto";
import { CandidatesService } from "./candidates.service";

@Controller("candidates")
export class CandidatesController {
  constructor(private readonly candidatesService: CandidatesService) {}

  @Get()
  findMany(@Query() query: Record<string, string>) {
    return this.candidatesService.findMany(query);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.candidatesService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateCandidateDto, @CurrentUser() user: RequestUser) {
    return this.candidatesService.create(dto, user?.sub);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateCandidateDto) {
    return this.candidatesService.update(id, dto);
  }
}
