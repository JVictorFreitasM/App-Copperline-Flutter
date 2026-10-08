// Funcoes puras que leem uma sessao do Redis (express-session) sem depender de
// Nest/Redis - testadas isoladamente (informacao-sessao.spec.ts).

export type PlataformaAcesso = 'mobile' | 'web' | 'desconhecida';

// O JWT da sessao e' confiavel aqui: veio do nosso proprio Redis, gravado pelo
// idp-client depois de verificar a assinatura. So decodifica o payload para ler
// o `sub` (nunca decide permissao por isso).
export function subDoAccessToken(accessToken: unknown): string | null {
  if (typeof accessToken !== 'string') return null;
  const partes = accessToken.split('.');
  if (partes.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(partes[1], 'base64url').toString('utf8')) as {
      sub?: unknown;
    };
    return typeof payload.sub === 'string' && payload.sub.length > 0 ? payload.sub : null;
  } catch {
    return null;
  }
}

export function plataformaDaRequisicao(cabecalhos: {
  appCliente?: string;
  userAgentRepassado?: string;
  userAgent?: string;
}): PlataformaAcesso {
  if (cabecalhos.appCliente === 'mobile' || cabecalhos.userAgent?.startsWith('Dart/')) {
    return 'mobile';
  }
  if (cabecalhos.userAgentRepassado) return 'web';
  return 'desconhecida';
}

// "Chrome 130 no Windows", "Aplicativo Android" etc. - so pra o admin
// reconhecer o aparelho; nao e' identificacao confiavel (UA e' declarado pelo
// cliente).
export function resumirDispositivo(plataforma: PlataformaAcesso, userAgent?: string): string {
  if (plataforma === 'mobile') {
    const modelo = userAgent?.match(/Android [\d.]+; ([^;)]+)/)?.[1]?.trim();
    return modelo ? `Aplicativo (${modelo})` : 'Aplicativo Copperline';
  }
  if (!userAgent) return 'Dispositivo desconhecido';
  const navegador =
    userAgent.match(/(Edg|Firefox|OPR)\/([\d]+)/) ??
    userAgent.match(/(Chrome)\/([\d]+)/) ??
    userAgent.match(/Version\/([\d]+).*(Safari)/);
  let nomeNavegador = 'Navegador';
  if (navegador) {
    const bruto = navegador[1] === 'Edg' ? 'Edge' : navegador[1] === 'OPR' ? 'Opera' : navegador[1];
    nomeNavegador = /^\d+$/.test(bruto) ? `Safari ${bruto}` : `${bruto} ${navegador[2]}`;
  }
  const so = /Windows/.test(userAgent)
    ? 'Windows'
    : /Android/.test(userAgent)
      ? 'Android'
      : /iPhone|iPad/.test(userAgent)
        ? 'iOS'
        : /Mac OS X/.test(userAgent)
          ? 'macOS'
          : /Linux/.test(userAgent)
            ? 'Linux'
            : null;
  return so ? `${nomeNavegador} no ${so}` : nomeNavegador;
}
