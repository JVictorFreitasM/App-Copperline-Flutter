import { Controller, Get } from '@nestjs/common';
import type { IdpUser } from '@copperline/idp-client';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  @Get('me')
  me(@CurrentUser() user: IdpUser): IdpUser {
    return user;
  }
}
