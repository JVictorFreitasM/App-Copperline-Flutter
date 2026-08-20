import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { IdpUser } from '@copperline/idp-client';
import type { Request } from 'express';

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): IdpUser => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.user as IdpUser;
  },
);
