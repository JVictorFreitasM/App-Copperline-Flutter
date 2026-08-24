import { PushNotificationClientService } from './push-notification-client.service';

jest.mock('firebase-admin/app', () => ({
  initializeApp: jest.fn().mockReturnValue({ name: 'app-fake' }),
  cert: jest.fn((c: unknown) => c),
}));

jest.mock('firebase-admin/messaging', () => ({
  getMessaging: jest.fn(),
}));

function configServiceFake(valor?: string) {
  return { get: jest.fn().mockReturnValue(valor) };
}

describe('PushNotificationClientService', () => {
  it('nao lanca erro no boot quando a credencial nao esta configurada (fica indisponivel, nao derruba a app)', () => {
    const service = new PushNotificationClientService(configServiceFake(undefined) as never);

    expect(() => service.onModuleInit()).not.toThrow();
  });

  it('enviar() lanca erro claro quando a credencial nao foi configurada', async () => {
    const service = new PushNotificationClientService(configServiceFake(undefined) as never);
    service.onModuleInit();

    await expect(service.enviar(['token-1'], { titulo: 't', corpo: 'c' })).rejects.toThrow(
      /FIREBASE_SERVICE_ACCOUNT_JSON/,
    );
  });

  it('onModuleInit lanca erro claro quando a credencial configurada nao e JSON valido', () => {
    const service = new PushNotificationClientService(
      configServiceFake('isso-nao-e-json') as never,
    );

    expect(() => service.onModuleInit()).toThrow(/inválida/);
  });

  it('enviar() retorna lista vazia sem chamar o Firebase quando nao ha tokens', async () => {
    const service = new PushNotificationClientService(
      configServiceFake(JSON.stringify({ project_id: 'fake' })) as never,
    );
    service.onModuleInit();

    const resultado = await service.enviar([], { titulo: 't', corpo: 'c' });

    expect(resultado).toEqual({ sucesso: [], falha: [] });
  });

  it('enviar() separa tokens com sucesso/falha a partir da resposta do FCM', async () => {
    const { getMessaging } = jest.requireMock('firebase-admin/messaging') as {
      getMessaging: jest.Mock;
    };
    getMessaging.mockReturnValue({
      sendEachForMulticast: jest.fn().mockResolvedValue({
        responses: [{ success: true }, { success: false }],
      }),
    });
    const service = new PushNotificationClientService(
      configServiceFake(JSON.stringify({ project_id: 'fake' })) as never,
    );
    service.onModuleInit();

    const resultado = await service.enviar(['token-ok', 'token-falho'], {
      titulo: 't',
      corpo: 'c',
    });

    expect(resultado).toEqual({ sucesso: ['token-ok'], falha: ['token-falho'] });
  });
});
