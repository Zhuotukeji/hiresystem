import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export type RequestUser = {
  sub: string;
  email: string;
  role: string;
  name: string;
};

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): RequestUser | undefined => {
  const request = ctx.switchToHttp().getRequest();
  return request.user;
});
