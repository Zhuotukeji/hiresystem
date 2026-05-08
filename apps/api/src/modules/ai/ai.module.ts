import { Module } from "@nestjs/common";
import { AiController } from "./ai.controller";
import { AiProvider } from "./ai.provider";
import { AiService } from "./ai.service";

@Module({
  controllers: [AiController],
  providers: [AiService, AiProvider],
  exports: [AiService]
})
export class AiModule {}
