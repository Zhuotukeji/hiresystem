import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { CurrentUser, RequestUser } from "../../common/current-user.decorator";
import { CreateInterviewDto, SubmitFeedbackDto } from "./interviews.dto";
import { InterviewsService } from "./interviews.service";

@Controller("interviews")
export class InterviewsController {
  constructor(private readonly interviewsService: InterviewsService) {}

  @Post()
  create(@Body() dto: CreateInterviewDto) {
    return this.interviewsService.create(dto);
  }

  @Get(":id/workspace")
  workspace(@Param("id") id: string) {
    return this.interviewsService.workspace(id);
  }

  @Post(":id/feedback")
  submitFeedback(@Param("id") id: string, @Body() dto: SubmitFeedbackDto, @CurrentUser() user: RequestUser) {
    return this.interviewsService.submitFeedback(id, dto, user?.sub);
  }
}
