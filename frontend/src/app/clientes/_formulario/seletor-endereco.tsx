import { descreverEndereco, type EnderecoFormulario } from "@/lib/cadastro-cliente";

export const NOVO_ENDERECO = "__novo__";

// Seletor "Endereço de Cobrança/Entrega" da tela de referência: "A definir",
// os endereços já informados neste formulário e "+ Cadastrar novo endereço..."
// (abre o popup). Mostra o endereço escolhido em duas linhas.
export function SeletorEndereco({
  rotulo,
  enderecos,
  selecionado,
  onEscolher,
}: {
  rotulo: string;
  enderecos: EnderecoFormulario[];
  selecionado: number | null;
  onEscolher: (valor: string) => void;
}) {
  const escolhido = selecionado !== null ? enderecos[selecionado] : undefined;
  const [linha1, linha2] = escolhido ? descreverEndereco(escolhido) : ["", ""];

  return (
    <div className="flex flex-col gap-1 text-xs text-muted">
      {rotulo}
      <select
        aria-label={rotulo}
        value={selecionado === null ? "" : String(selecionado)}
        onChange={(evento) => onEscolher(evento.target.value)}
        className="rounded-full bg-background px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary-light"
      >
        <option value="">A definir</option>
        {enderecos.map((endereco, indice) => (
          <option key={`${endereco.cep}-${indice}`} value={String(indice)}>
            {descreverEndereco(endereco)[0]}
          </option>
        ))}
        <option value={NOVO_ENDERECO}>+ Cadastrar novo endereço...</option>
      </select>
      {escolhido && (
        <span className="text-sm text-ink">
          {linha1}
          <br />
          <span className="text-xs text-muted">{linha2}</span>
        </span>
      )}
    </div>
  );
}
