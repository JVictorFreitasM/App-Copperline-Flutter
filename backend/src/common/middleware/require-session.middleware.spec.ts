import { UnauthorizedException } from '@nestjs/common';
import { RequireSessionMiddleware } from './require-session.middleware';

describe('RequireSessionMiddleware', () => {
  const middleware = new RequireSessionMiddleware();

  it('chama next(UnauthorizedException) quando nao ha sessao', () => {
    const req = { session: {} } as never;
    const next = jest.fn();

    middleware.use(req, {} as never, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedException));
  });

  it('chama next() sem erro quando ha sessao autenticada', () => {
    const req = { session: { idpAuth: { accessToken: 'x' } } } as never;
    const next = jest.fn();

    middleware.use(req, {} as never, next);

    expect(next).toHaveBeenCalledWith();
  });
});
