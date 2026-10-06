import type { ApiError } from "./api";

// O backend devolve o corpo do erro dentro da mensagem do ApiError
// ("API respondeu 409 para ...: {"message":"..."}") - extrai só o texto que
// faz sentido mostrar ao usuário.
export function extrairMensagemApi(error: ApiError): string {
  const inicioJson = error.message.indexOf("{");
  if (inicioJson === -1) {
    return error.message;
  }
  try {
    const corpo = JSON.parse(error.message.slice(inicioJson)) as { message?: string | string[] };
    return Array.isArray(corpo.message) ? corpo.message.join("; ") : (corpo.message ?? error.message);
  } catch {
    return error.message;
  }
}
