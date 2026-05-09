import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { CurrentUser, RequestUser } from "../../common/current-user.decorator";
import { Roles } from "../../common/roles.decorator";
import { CreateUserDto, ResetUserPasswordDto, UpdateUserDto } from "./users.dto";
import { UsersService } from "./users.service";

@Roles("ADMIN")
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findMany() {
    return this.usersService.findMany();
  }

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateUserDto, @CurrentUser() user: RequestUser) {
    return this.usersService.update(id, dto, user.sub);
  }

  @Patch(":id/password")
  resetPassword(@Param("id") id: string, @Body() dto: ResetUserPasswordDto) {
    return this.usersService.resetPassword(id, dto.password);
  }

  @Delete(":id")
  disable(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.usersService.disable(id, user.sub);
  }
}
