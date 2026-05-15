import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export interface CurrentUser { id: string; username: string; }

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
