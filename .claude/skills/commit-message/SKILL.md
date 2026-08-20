---
name: commit-message
description: Gera mensagens de commit no padrão Conventional Commits a partir das mudanças staged no git. Use quando o usuário pedir para "escrever o commit", "gerar mensagem de commit" ou "commitar as mudanças".
---

## Instruções

1. Rode `git diff --staged` para ver as mudanças. Se estiver vazio, avise o usuário e pergunte se quer que rode `git add` primeiro (não rode sem confirmação).
2. Identifique o tipo da mudança: feat, fix, refactor, chore, docs, test, perf, style.
3. Identifique o escopo quando possível, baseado na pasta/módulo alterado (ex: `auth`, `orders`, `mobile-onboarding`).
4. Gere a mensagem no formato:
   ```
   tipo(escopo): descrição curta no imperativo, em português, até ~72 caracteres

   Corpo opcional explicando o "porquê" da mudança, não o "o quê" (o diff já mostra o quê).
   ```
5. Se houver mudanças que quebram compatibilidade (breaking change), adicione `BREAKING CHANGE:` no rodapé.
6. Não crie o commit automaticamente — mostre a mensagem sugerida e espere confirmação do usuário antes de rodar `git commit`.
