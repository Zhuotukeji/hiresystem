import { Body, Controller, Get, Post } from "@nestjs/common";
import { CurrentUser, RequestUser } from "../../common/current-user.decorator";
import { Public } from "../../common/public.decorator";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("login")
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get("me")
  me(@CurrentUser() user: RequestUser) {
    return user;
  }
}
