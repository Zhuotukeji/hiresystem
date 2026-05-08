import { Module, forwardRef } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { ApplicationsController } from "./applications.controller";
import { ApplicationsService } from "./applications.service";

@Module({
  imports: [forwardRef(() => AiModule)],
  controllers: [ApplicationsController],
  providers: [ApplicationsService],
  exports: [ApplicationsService]
})
export class ApplicationsModule {}
