---
name: nestjs
description: |
  Padroes de desenvolvimento NestJS: modulos orientados a dominio, DI, decorators, guards/interceptors/pipes, Clean Code. Cobre convencoes do projeto para Prisma, jobs BullMQ/Redis, sincronizacao com ERP, e quando/como aplicar DDD (entidades, value objects, agregados) em modulos com regra de negocio real.
  Use quando: construir modulos/controllers/services NestJS, APIs REST ou GraphQL, DI, guards, decorators, autenticacao, Prisma, filas BullMQ/Redis, sincronizacao com API externa de ERP, modelar entidades de dominio, ou decidir se um modulo precisa de DDD.
---

# Padrões de Desenvolvimento NestJS

## Princípios de Organização de Módulos

### Modularização Orientada a Domínio

Organize os módulos por domínio de negócio, não por função.

- ❌ Ruim: `controllers/`, `services/`, `repositories/`
- ✅ Bom: `users/`, `products/`, `orders/`

### Módulo com Responsabilidade Única

Cada módulo é responsável por apenas um domínio.

- Separe funcionalidades comuns em módulos `common/` ou `shared/`
- A comunicação entre domínios deve passar apenas por Services

## Regras de Injeção de Dependência

### Apenas Injeção via Construtor

Injeção por propriedade (@Inject) é proibida.

```typescript
// ✅ Bom
constructor(private readonly userService: UserService) {}

// ❌ Ruim
@Inject() userService: UserService;
```

### Local de Registro de Providers

Providers são registrados apenas no módulo onde são usados.

- Minimize providers globais
- Use forRoot/forRootAsync apenas no AppModule

## Regras de Uso de Decorators

### Priorize Decorators Customizados

Abstraia combinações repetidas de decorators em decorators customizados.

```typescript
// Crie um decorator customizado ao combinar 3+ decorators
@Auth() // Integra @UseGuards + @ApiBearerAuth + @CurrentUser
```

### Ordem dos Decorators

Organize na ordem de execução, de cima para baixo.

1. Decorators de metadata (@ApiTags, @Controller, @Resolver)
2. Guards/Interceptors (@UseGuards, @UseInterceptors)
3. Decorators de rota (@Get, @Post, @Query, @Mutation)
4. Decorators de parâmetro (@Body, @Param, @Args)

## Clean Code

Regras de legibilidade no nível de função e classe, independentes de qual arquitetura maior o módulo segue.

### Nomes Revelam Intenção

Nomes de funções, classes e variáveis devem descrever o que fazem, não como fazem.

```typescript
// ✅ Bom
async calcularDescontoPorFidelidade(cliente: Cliente): Promise<number> {}

// ❌ Ruim
async calc(c: Cliente): Promise<number> {}
```

### Funções Pequenas, Uma Responsabilidade

Se uma função faz "buscar E validar E notificar", divida em três funções. Cada função deve ser legível de cima a baixo sem exigir scroll.

### Sem Efeitos Colaterais Escondidos

Uma função cujo nome sugere apenas leitura ou validação (`validarPedido`) não deve, silenciosamente, gravar no banco ou disparar um evento. Se ela faz isso, o nome deve dizer (`validarESalvarPedido`) — ou, melhor, separe em duas chamadas explícitas.

### Evite Flags Booleanas em Parâmetros

```typescript
// ❌ Ruim — o que esse `true` significa no call site?
processarPedido(pedido, true);

// ✅ Bom — a intenção fica explícita
processarPedido(pedido, { notificarCliente: true });
```

### Poucos Parâmetros

Mais de 3 parâmetros posicionais é sinal de que a função deveria receber um objeto de opções, ou de que está fazendo coisa demais.

## Regras de DTO/Entity

### DTO é Transferência Pura de Dados

Lógica de negócio é proibida; apenas validação é permitida.

```typescript
// ✅ Bom: apenas validação
class CreateUserDto {
  @IsEmail()
  email: string;
}

// ❌ Ruim: contém lógica de negócio
class CreateUserDto {
  toEntity(): User {} // Proibido
}
```

### Separe Entity e DTO

Nunca retorne a Entity diretamente; sempre converta para DTO.

- Requisição: CreateInput, UpdateInput (GraphQL) / CreateDto, UpdateDto (REST)
- Resposta: definição de tipo ou objeto simples

## Tratamento de Erros

### Exception Filter Específico por Domínio

Cada domínio tem seu próprio Exception Filter.

```typescript
@Module({
  providers: [
    {
      provide: APP_FILTER,
      useClass: UserExceptionFilter,
    },
  ],
})
```

### Lançamento Explícito de Erros

Sempre lance uma Exception explicitamente em toda situação de erro.

- REST: use a série HttpException
- GraphQL: use GraphQLError ou erro customizado
- Proíba retornos implícitos de null/undefined
- Mensagens de erro devem ser compreensíveis pelo usuário

---

## Padrões Específicos do Projeto: Camada de Dados, Filas e Sincronização com ERP

As regras abaixo são decisões arquiteturais tomadas especificamente para este projeto. Elas se somam (e não substituem) os padrões gerais de NestJS acima.

### ORM: Prisma, não TypeORM

Escolhido em vez do TypeORM para este projeto porque:

- **Upsert é de primeira classe.** `prisma.<entidade>.upsert({ where: { idExternoErp }, update, create })` é exatamente o formato necessário para toda strategy de sincronização com o ERP — mais limpo que o equivalente no TypeORM.
- **Migrations são revisáveis.** `prisma migrate dev` gera SQL legível que você inspeciona antes de aplicar, ao contrário do fluxo do TypeORM (`synchronize:false` + migrations manuais).
- **O schema vive em um único arquivo `.prisma`**, não espalhado em classes de entidade decoradas — mantém as classes de domínio livres de decorators de ORM (`@Entity`, `@Column`).
- **Tipagem end-to-end** reflete as relações automaticamente — importante aqui porque as entidades do ERP (pedidos → clientes → produtos) são relacionais.

Só reconsidere o TypeORM se o time já tiver experiência profunda com ele, ou se uma query específica precisar do Query Builder bruto para algo que o Prisma não consiga expressar de forma limpa.

### Jobs em background: BullMQ sobre Redis

Qualquer trabalho que (a) fale com um sistema externo lento/instável, (b) não deva bloquear uma resposta HTTP, ou (c) precise de retry/backoff, passa por uma fila BullMQ — nunca executado de forma síncrona dentro de um controller.

O que isso garante, e por que é inegociável especificamente para a sincronização com o ERP:
- **Retry automático com backoff exponencial** quando o ERP der timeout ou erro transitório.
- **Concorrência controlada** (`concurrency: N` no processor) para respeitar o rate limit do ERP — não dispare dezenas de requisições paralelas contra uma API externa.
- **Persistência entre reinicializações** — um job sobrevive a um restart da aplicação porque vive no Redis, não em memória.

### Arquitetura de Sincronização com ERP

Este é o padrão de referência para qualquer funcionalidade de "puxar dados de um sistema externo para o Postgres" — não só para o ERP, use também para qualquer futura fonte de dados externa.

**Camadas (cada peça tem exatamente uma responsabilidade):**

1. **`sync.scheduler.ts`** — apenas enfileira jobs em um cron schedule (`@nestjs/schedule`). Nenhuma lógica de negócio aqui.
2. **`sync.processor.ts`** — o `WorkerHost` do BullMQ que consome a fila e delega ao orquestrador. É aqui que `concurrency` e a política de retry são configuradas.
3. **`sync.service.ts`** — o orquestrador. Dado "sincronize a entidade X", escolhe a strategy certa, executa, e é o único lugar que escreve em `sync_logs` (início, fim, contagens, erros). Centralizar o log aqui garante auditoria consistente para toda entidade, de graça.
4. **strategies `<entidade>.sync.ts`** — um arquivo por entidade sincronizada (ex: `clientes.sync.ts`, `produtos.sync.ts`). Cada uma implementa a mesma interface: `fetch()`, `map()`, `upsert()`. Adicionar uma nova entidade sincronizada significa adicionar um novo arquivo de strategy — o scheduler, o processor e o service nunca mudam.
5. **módulo `erp-client`** — um módulo à parte, fora de `sync/`, responsável por autenticação HTTP, headers e retry contra a API do ERP. As strategies chamam esse módulo em vez de fazer suas próprias chamadas HTTP, então trocar de ERP ou mudar a autenticação depois afeta apenas um lugar.

**Convenções de dados (aplicam-se a toda tabela populada por uma strategy de sincronização):**

- `id` (uuid): sua própria PK gerada internamente. Nunca reutilize o ID do ERP como chave primária — ERPs podem reciclar IDs ou formatá-los de forma inconsistente.
- `id_externo_erp`: o identificador do ERP, mantido como coluna de referência. É essa a cláusula `WHERE` dos upserts (`ON CONFLICT (id_externo_erp) DO UPDATE`).
- `sincronizado_em`: timestamp da última sincronização bem-sucedida daquela linha — necessário para avaliar desatualização e debugar sincronizações parciais.

**Auditoria:** toda execução de sincronização grava uma linha em `sync_logs` (ligada a uma linha de `sync_entities`) com horário de início/fim, contagem de registros, contagem de erros e — de forma crítica — o payload de erro bruto em caso de falha. Essa tabela é o que torna possível diagnosticar quando o ERP muda silenciosamente o formato de um campo, em vez de ficar adivinhando.

**Direção do fluxo:** ERP → Postgres é unidirecional por padrão. Se uma funcionalidade precisar escrever de volta no ERP (ex: um pedido criado neste sistema precisa refletir lá), trate isso como um fluxo *separado*, com sua própria fila e tratamento de erro — nunca misture a escrita de volta com o pipeline de leitura/sincronização.

### Proteção de Endpoints

Endpoints administrativos/internos que disparam sincronizações manuais ou expõem status de sincronização devem estar atrás de um Guard (API key ou baseado em role) — nunca exponha endpoints de disparo de sync sem autenticação, já que podem ser usados para estourar o rate limit do ERP.

---

## DDD (Domain-Driven Design)

Aplique estes padrões **por módulo**, não no sistema inteiro de uma vez. A pergunta que decide é: **este módulo carrega regra de negócio real (decisões, validações, cálculos que mudam com frequência), ou é essencialmente transporte de dados (fetch → map → salvar)?**

- Módulos de sincronização crua (`clientes.sync.ts`, `produtos.sync.ts`) **não** precisam disso — aplicar aqui é overhead sem ganho.
- Módulos com regra de negócio genuína (conciliação, faturamento, cálculos, validações com múltiplos cenários) **se beneficiam** — é aqui que a separação paga o custo extra de arquivos.

### Domain-Driven Design (DDD)

DDD é sobre modelar o problema de negócio em código, não sobre organização técnica de pastas.

- **Linguagem Ubíqua**: o código usa os mesmos termos que o negócio usa. Se o time fala "pedido pendente de faturamento", a classe não se chama `OrderStatus3`.
- **Entidades**: objetos com identidade que persiste no tempo (`Pedido` continua o mesmo pedido mesmo que o status mude). A regra de negócio vive dentro da entidade, não em um service externo que só lê e escreve seus campos.
- **Value Objects**: definidos só pelo valor, sem identidade própria (`CPF`, `Dinheiro` — dois iguais são o mesmo objeto).
- **Agregados**: um grupo de entidades tratado como unidade transacional, com uma raiz que controla o acesso (`Pedido` é a raiz; `ItemDoPedido` só é alterado através dele).
- **Domain Services**: lógica que não pertence naturalmente a uma única entidade (ex: cálculo de frete que depende de pedido + endereço + transportadora).
- **Bounded Contexts**: o mesmo termo pode significar coisas diferentes em contextos diferentes (`Cliente` no contexto de vendas ≠ `Cliente` no contexto de faturamento). Não force um único modelo gigante para tudo.

```typescript
// domain/pedido.entity.ts — a regra de negócio vive na entidade, testável sem banco
export class Pedido {
  constructor(
    private readonly idExternoErp: string,
    private status: StatusPedido,
    private valorTotal: number,
  ) {}

  podeAtualizarStatusPara(novoStatus: StatusPedido): boolean {
    if (this.status === StatusPedido.FATURADO && novoStatus === StatusPedido.CANCELADO) {
      return false;
    }
    return true;
  }

  atualizarStatus(novoStatus: StatusPedido) {
    if (!this.podeAtualizarStatusPara(novoStatus)) {
      throw new PedidoJaFaturadoError(this.idExternoErp);
    }
    this.status = novoStatus;
  }
}
```

### Onde a Regra de Negócio Deve Viver

Mesmo sem uma arquitetura de portas/adapters formal, a entidade de domínio (`Pedido`) deve ser o lugar da regra de negócio — não o service que orquestra a sincronização, nem o repositório. O service/use case orquestra chamadas; a entidade decide.

```typescript
// application/sincronizar-pedidos.service.ts — orquestra, não decide regra de negócio
@Injectable()
export class SincronizarPedidosService {
  constructor(
    private prisma: PrismaService,
    private erpClient: ErpClientService,
  ) {}

  async executar() {
    const pedidosErp = await this.erpClient.buscarPedidosAlterados(ultimaSync);
    for (const dto of pedidosErp) {
      const row = await this.prisma.pedido.findUnique({ where: { idExternoErp: dto.id } });
      let pedido = row ? new Pedido(row.idExternoErp, row.status, row.valorTotal) : new Pedido(dto.id, dto.status, dto.valor);

      if (row) {
        pedido.atualizarStatus(dto.status); // a regra decide, o service só orquestra
      }

      await this.prisma.pedido.upsert({
        where: { idExternoErp: pedido.idExternoErp },
        update: { status: pedido.status },
        create: { idExternoErp: pedido.idExternoErp, status: pedido.status, valorTotal: pedido.valorTotal },
      });
    }
  }
}
```

**Ganho concreto**: a regra `podeAtualizarStatusPara` fica testável isoladamente — `new Pedido(...)` e chama o método, sem banco, sem mock de Prisma, sem HTTP. Isso não exige repositório abstrato nem porta — só disciplina de não deixar a regra vazar para dentro do service ou do controller.

**Estrutura de pastas sugerida quando o módulo tem entidades de domínio:**

```
pedidos/
├── domain/
│   └── pedido.entity.ts
├── pedidos.service.ts
├── pedidos.controller.ts
└── pedidos.module.ts
```
