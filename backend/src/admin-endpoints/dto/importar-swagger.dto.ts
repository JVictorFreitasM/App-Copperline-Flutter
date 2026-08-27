import { IsString, IsUrl, Matches } from 'class-validator';

export class ImportarSwaggerDto {
  // Ferramenta administrativa (ApiKeyGuard) usada por quem mantem o
  // backend pra importar um endpoint do WK Radar - nao e' input de usuario
  // final, mesmo nivel de confianca de POST /admin/sync/:entidade/executar-agora.
  @IsUrl({ require_tld: false })
  swaggerUrl!: string;

  // Path exatamente como aparece em `paths` no documento OpenAPI (ex:
  // "/empresarial/v1/produto").
  @IsString()
  @Matches(/^\//, { message: 'caminhoEndpoint deve comecar com "/"' })
  caminhoEndpoint!: string;

  // kebab-case, mesmo padrao de SyncStrategy.nomeEntidade (ex: "produto",
  // "nota-fiscal") - usado pra nomear o model/arquivo gerados no rascunho.
  @IsString()
  @Matches(/^[a-z][a-z0-9-]*$/, {
    message: 'nomeEntidade deve ser kebab-case (ex: "produto", "nota-fiscal")',
  })
  nomeEntidade!: string;
}
