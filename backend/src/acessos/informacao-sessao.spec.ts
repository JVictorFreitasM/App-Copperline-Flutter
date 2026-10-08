import { plataformaDaRequisicao, resumirDispositivo, subDoAccessToken } from './informacao-sessao';

function jwt(payload: object): string {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'RS256' })}.${b64(payload)}.assinatura`;
}

describe('subDoAccessToken', () => {
  it('le o sub do payload', () => {
    expect(subDoAccessToken(jwt({ sub: 'abc-123' }))).toBe('abc-123');
  });
  it.each([undefined, null, 42, 'nao-e-jwt', 'a.b.c', jwt({ sem: 'sub' }), jwt({ sub: '' })])(
    'devolve null para %p',
    (valor) => {
      expect(subDoAccessToken(valor)).toBeNull();
    },
  );
});

describe('plataformaDaRequisicao', () => {
  it('header do app ou UA Dart = mobile', () => {
    expect(plataformaDaRequisicao({ appCliente: 'mobile' })).toBe('mobile');
    expect(plataformaDaRequisicao({ userAgent: 'Dart/3.5 (dart:io)' })).toBe('mobile');
  });
  it('UA do navegador repassado pelo Next = web', () => {
    expect(plataformaDaRequisicao({ userAgentRepassado: 'Mozilla/5.0' })).toBe('web');
  });
  it('sem pistas = desconhecida', () => {
    expect(plataformaDaRequisicao({ userAgent: 'node' })).toBe('desconhecida');
  });
});

describe('resumirDispositivo', () => {
  it('Chrome no Windows', () => {
    const ua =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
    expect(resumirDispositivo('web', ua)).toBe('Chrome 130 no Windows');
  });
  it('Edge tem prioridade sobre Chrome', () => {
    const ua =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0';
    expect(resumirDispositivo('web', ua)).toBe('Edge 130 no Windows');
  });
  it('app mobile sem modelo no UA', () => {
    expect(resumirDispositivo('mobile', 'Dart/3.5 (dart:io)')).toBe('Aplicativo Copperline');
  });
  it('sem UA', () => {
    expect(resumirDispositivo('web', undefined)).toBe('Dispositivo desconhecido');
  });
});
