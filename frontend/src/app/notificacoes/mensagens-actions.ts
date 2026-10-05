"use server";

import { revalidatePath } from "next/cache";
import { apiFetch, ApiError } from "@/lib/api";
import { redirecionarParaLogin } from "@/lib/auth";
import type {
  DestinoMensagem,
  FrequenciaMensagem,
  GrupoMensagemDto,
  MensagemPeriodicaDto,
  ResultadoEnvioMensagemDto,
} from "@/lib/mensagens";

const ROTA = "/notificacoes";

// Só admin (requireRole('admin') no backend, ver notificacoes.module.ts) -
// 403 do backend vira mensagem na tela, nunca confia no esconder-botão do
// front como controle de acesso.
export type ResultadoAcao<T = void> =
  | { ok: true; dados: T }
  | { ok: false; erro: string };

// ApiError.message traz o corpo cru da resposta ("API respondeu 422 para
// <url>: {...}") - extrai só o `message` do Nest pra mostrar ao usuário.
function mensagemDeErro(error: unknown, padrao: string): string {
  if (!(error instanceof ApiError)) return padrao;
  const inicioJson = error.message.indexOf("{");
  if (inicioJson >= 0) {
    try {
      const { message } = JSON.parse(error.message.slice(inicioJson)) as { message?: string | string[] };
      if (Array.isArray(message)) return message.join("; ");
      if (message) return message;
    } catch {
      // corpo não era JSON - cai no padrão abaixo.
    }
  }
  return error.status === 403 ? "Apenas administradores podem usar esta função." : padrao;
}

async function executar<T>(
  chamada: () => Promise<T>,
  padrao: string,
): Promise<ResultadoAcao<T>> {
  try {
    return { ok: true, dados: await chamada() };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return redirecionarParaLogin(ROTA);
    }
    return { ok: false, erro: mensagemDeErro(error, padrao) };
  }
}

export interface EnviarMensagemInput {
  destino: DestinoMensagem;
  vendedorId?: string;
  grupoId?: string;
  assunto: string;
  mensagem: string;
}

export async function enviarMensagem(
  input: EnviarMensagemInput,
): Promise<ResultadoAcao<ResultadoEnvioMensagemDto>> {
  const resultado = await executar(
    () =>
      apiFetch<ResultadoEnvioMensagemDto>("/admin/mensagens", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    "Erro desconhecido ao enviar a mensagem.",
  );
  if (resultado.ok) revalidatePath(ROTA);
  return resultado;
}

export async function criarGrupo(
  nome: string,
  vendedorIds: string[],
): Promise<ResultadoAcao<GrupoMensagemDto>> {
  const resultado = await executar(
    () =>
      apiFetch<GrupoMensagemDto>("/admin/grupos-mensagem", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, vendedorIds }),
      }),
    "Erro desconhecido ao criar o grupo.",
  );
  if (resultado.ok) revalidatePath(ROTA);
  return resultado;
}

export async function atualizarGrupo(
  id: string,
  nome: string,
  vendedorIds: string[],
): Promise<ResultadoAcao<GrupoMensagemDto>> {
  const resultado = await executar(
    () =>
      apiFetch<GrupoMensagemDto>(`/admin/grupos-mensagem/${encodeURIComponent(id)}`, {
        method: "PATCH",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, vendedorIds }),
      }),
    "Erro desconhecido ao salvar o grupo.",
  );
  if (resultado.ok) revalidatePath(ROTA);
  return resultado;
}

export async function removerGrupo(id: string): Promise<ResultadoAcao> {
  const resultado = await executar(
    () =>
      apiFetch<void>(`/admin/grupos-mensagem/${encodeURIComponent(id)}`, {
        method: "DELETE",
        cache: "no-store",
      }),
    "Erro desconhecido ao remover o grupo.",
  );
  if (resultado.ok) revalidatePath(ROTA);
  return resultado;
}

export async function reenviarMensagem(id: string): Promise<ResultadoAcao<ResultadoEnvioMensagemDto>> {
  const resultado = await executar(
    () =>
      apiFetch<ResultadoEnvioMensagemDto>(`/admin/mensagens/${encodeURIComponent(id)}/reenviar`, {
        method: "POST",
        cache: "no-store",
      }),
    "Erro desconhecido ao reenviar a mensagem.",
  );
  if (resultado.ok) revalidatePath(ROTA);
  return resultado;
}

export interface SalvarPeriodicaInput extends EnviarMensagemInput {
  frequencia: FrequenciaMensagem;
  horario: string;
  diaSemana?: number;
  diaMes?: number;
}

export async function criarPeriodica(
  input: SalvarPeriodicaInput,
): Promise<ResultadoAcao<MensagemPeriodicaDto>> {
  const resultado = await executar(
    () =>
      apiFetch<MensagemPeriodicaDto>("/admin/mensagens-periodicas", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    "Erro desconhecido ao agendar a mensagem.",
  );
  if (resultado.ok) revalidatePath(ROTA);
  return resultado;
}

export async function atualizarPeriodica(
  id: string,
  input: SalvarPeriodicaInput,
): Promise<ResultadoAcao<MensagemPeriodicaDto>> {
  const resultado = await executar(
    () =>
      apiFetch<MensagemPeriodicaDto>(`/admin/mensagens-periodicas/${encodeURIComponent(id)}`, {
        method: "PATCH",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    "Erro desconhecido ao salvar a mensagem periódica.",
  );
  if (resultado.ok) revalidatePath(ROTA);
  return resultado;
}

export async function alternarPeriodica(
  id: string,
  ativa: boolean,
): Promise<ResultadoAcao<MensagemPeriodicaDto>> {
  const resultado = await executar(
    () =>
      apiFetch<MensagemPeriodicaDto>(`/admin/mensagens-periodicas/${encodeURIComponent(id)}/ativa`, {
        method: "PATCH",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ativa }),
      }),
    "Erro desconhecido ao alterar a mensagem periódica.",
  );
  if (resultado.ok) revalidatePath(ROTA);
  return resultado;
}

export async function removerPeriodica(id: string): Promise<ResultadoAcao> {
  const resultado = await executar(
    () =>
      apiFetch<void>(`/admin/mensagens-periodicas/${encodeURIComponent(id)}`, {
        method: "DELETE",
        cache: "no-store",
      }),
    "Erro desconhecido ao remover a mensagem periódica.",
  );
  if (resultado.ok) revalidatePath(ROTA);
  return resultado;
}
