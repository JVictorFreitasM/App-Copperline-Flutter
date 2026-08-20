---
name: flutter-widget
description: Cria widgets Flutter reutilizáveis e telas seguindo separação entre UI e gerenciamento de estado do projeto, e a identidade visual definida na skill `design-system`. Use quando o usuário pedir para "criar uma tela", "criar um widget" ou "criar componente" no app mobile. Para animações, temas, responsividade e padrões visuais mais elaborados, ver também a skill `flutter-ui-ux`.
---

## Instruções

1. Gerenciamento de estado: usar Riverpod (`Provider`/`NotifierProvider`/`AsyncNotifierProvider` conforme o caso) para **estado de app/negócio** — qualquer coisa vinda de API, compartilhada entre telas, ou que precise sobreviver à navegação (usuário logado, dados de listagem, tema selecionado). Preferir `AsyncNotifierProvider` para estado que depende de chamada assíncrona, expondo `AsyncValue` para o widget tratar loading/erro/dados.
2. Estruture o widget em camadas:
   - Widget "burro" (`ConsumerWidget` ou `ConsumerStatefulWidget`, recebe dados prontos via `ref.watch`).
   - Lógica de estado/side-effects de negócio isolada em providers Riverpod, nunca dentro do widget.
   - **Exceção**: estado puramente visual e efêmero (progresso de animação, se um card está expandido/colapsado, offset de drag) pode ficar em `StatefulWidget` local — não precisa de provider. Ver seção "Project State Management Convention" da skill `flutter-ui-ux` para esse critério.
3. Nomeie arquivos e classes em PascalCase para widgets, snake_case para arquivos, seguindo a convenção padrão do Dart.
4. Reutilize componentes visuais já existentes no projeto (design system) em vez de recriar botões, inputs, cards, etc. — cor, tipografia, espaçamento e forma seguem os tokens definidos na skill `design-system`, não valor literal escolhido ad-hoc. Se não souber quais componentes já existem, pergunte ou liste o que está em `lib/widgets` ou pasta equivalente.
5. Trate os três estados de `AsyncValue` explicitamente com `.when(data:, loading:, error:)` — não deixar tela "quebrar" sem fallback.
6. Se a tela consumir dados do back-end (NestJS), assuma paginação e tratamento de erro de rede (timeout, sem conexão) dentro do `AsyncNotifier`, não no widget.
7. Para animações, transições, layout responsivo (`LayoutBuilder`/`MediaQuery`), temas customizados ou otimização de performance de renderização, consulte a skill `flutter-ui-ux` — ela tem os padrões de referência completos (com exemplos já alinhados a Riverpod) para essas áreas.
