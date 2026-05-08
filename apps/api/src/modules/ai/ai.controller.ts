import { Body, Controller, Param, Patch, Post } from "@nestjs/common";
import { CurrentUser, RequestUser } from "../../common/current-user.decorator";
import {
  CreateJdSessionDto,
  GenerateInterviewKitDto,
  ResumeEvaluationDto,
  SendJdMessageDto,
  OverrideEvaluationDto
} from "./ai.dto";
import { AiService } from "./ai.service";

@Controller("ai")
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post("jd-chat/sessions")
  createJdSession(@Body() dto: CreateJdSessionDto, @CurrentUser() user: RequestUser) {
    return this.aiService.createJdSession(dto, user?.sub);
  }

  @Post("jd-chat/:sessionId/messages")
  sendJdMessage(
    @Param("sessionId") sessionId: string,
    @Body() dto: SendJdMessageDto,
    @CurrentUser() user: RequestUser
  ) {
    return this.aiService.continueJdChat(sessionId, dto, user?.sub);
  }

  @Post("resume-evaluations")
  generateResumeEvaluation(@Body() dto: ResumeEvaluationDto, @CurrentUser() user: RequestUser) {
    return this.aiService.generateResumeEvaluation(dto, user?.sub);
  }

  @Patch("resume-evaluations/:id/override")
  overrideResumeEvaluation(
    @Param("id") id: string,
    @Body() dto: OverrideEvaluationDto,
    @CurrentUser() user: RequestUser
  ) {
    return this.aiService.overrideResumeEvaluation(id, dto, user?.sub);
  }

  @Post("interview-kits")
  generateInterviewKit(@Body() dto: GenerateInterviewKitDto, @CurrentUser() user: RequestUser) {
    return this.aiService.generateInterviewKit(dto.applicationId, dto.stage, user?.sub);
  }
}
