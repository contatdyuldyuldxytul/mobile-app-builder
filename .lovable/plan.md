
# Consertar a desconexão + nova identidade visual

## Parte 1 — Por que está desconexo (verificado no código)

Três causas confirmadas:

1. **O "Hoje" ignora a Semana Ideal que o onboarding montou.**
   `saveOnboarding` grava a grade em `ideal_week_blocks` (e existe a função `generateDayFromTemplate` para transformar isso no dia), mas a tela Hoje chama `ensureDayBlocks`, que **inventa o dia do zero** a partir do orçamento de horas — criando blocos e "Pausas" em horários que você nunca viu no passo 4. É daí que vêm "coisas que não existiam".

2. **Os dias escolhidos no onboarding se perdem.**
   No passo 4 você escolhe horas/dia e em quais dias, mas `saveOnboarding` só salva o total semanal: `preferred_days` nunca é gravado nas áreas. Por isso a aba Semana reabre tudo como "7 dias" e reparte o total por 7, mostrando números diferentes dos que você definiu.

3. **Duas fontes de verdade concorrentes.** Orçamento (horas/área) e Semana Ideal (blocos com horário) hoje geram o dia por caminhos separados, então divergem.

## Parte 2 — O que muda (uma só cascata)

Âncoras → Orçamento → **Semana Ideal** → Dia. A Semana Ideal passa a ser a única origem do dia.

- **Onboarding**: salvar também `preferred_days` por área (e as horas/dia efetivas), para que a Semana reabra exatamente o que foi definido.
- **Hoje**: trocar o preenchimento automático por `generateDayFromTemplate` — o dia nasce cópia fiel da Semana Ideal do dia da semana correspondente, com `ideal_block_id` ligando os dois. Sem inventar blocos. `ensureDayBlocks` vira apenas um "completar o que falta" acionado por botão explícito ("Preencher com o que sobrou do orçamento"), nunca automático.
- **Semana**: ao salvar o orçamento, regenerar a Semana Ideal das áreas afetadas (mesmo gerador do onboarding, `gerarSemanaIdeal`), para que mudar horas ali reflita em Hoje.
- **Sem duplicatas**: dia gerado é idempotente por `ideal_block_id`; blocos que você moveu/editou no dia continuam intocados e não voltam para o template.
- **Diagnóstico visível**: no Hoje, se não houver template para o dia, mostrar "Sua semana ideal não cobre este dia" com atalho, em vez de gerar blocos aleatórios.
- **Limpeza dos dados atuais**: como o app já criou blocos fantasmas, incluir um botão em Ajustes "Refazer meu dia a partir da semana ideal" que apaga blocos gerados automaticamente do dia e regenera.

## Parte 3 — Identidade visual Redima

Reescrever o design system em `src/styles.css` (tokens semânticos, tudo em oklch) e propagar nos componentes:

- **Cores**: fundo cream `#FEF3E5`; cards `#F9F9FB`; blocos suaves em mint `#E2EBE3`; texto navy `#0D1D37`, muted `#4F525C`; ação primária coral `#FD5B49`/`#FF8060`; progresso, checks e streaks em teal `#369792`; badges de categoria rotacionando lavender `#EADFEF`, mustard `#FEE4B9`, peach `#FED2B7`, mint; heros em navy ou rose `#FDBCB7`.
- **Tipografia**: títulos em serifada editorial (Fraunces/Playfair, 700–800), interface e números em sans humanista (Manrope), carregadas via `<link>` no root. Sai o esquema monoespaçado atual.
- **Forma**: cards raio 24px, botões 16px, chips pill, badges de ícone 14–16px; sombras difusas, quase sem borda.
- **Componentes afetados**: shell/navegação (barra inferior com botão central circular coral), Hoje (saudação serifada, card "Intenção do dia" em mint, anel de progresso teal com número grande, lista de próximas ações com badge de ícone colorido por área), Semana (cards e chips no novo raio/cores), onboarding, hábitos (checks circulares teal), botões, sliders e progress.
- Nada de cor fixa em componente: tudo por token, incluindo as cores por área da vida em `src/lib/areas.ts`.
- Modo escuro derivado do navy `#0D1D37` mantendo coral/teal como acentos.

## Detalhes técnicos

Arquivos principais: `src/lib/onboarding.ts` (gravar `preferred_days`), `src/routes/_authenticated/hoje.tsx` (usar `generateDayFromTemplate`, remover auto-`ensureDayBlocks`), `src/lib/cascade.ts` (regenerar template a partir do orçamento), `src/components/week-budget.tsx` (salvar e reler dias/horas coerentes), `src/lib/day-schedule.ts` (preenchimento só sob demanda), `src/styles.css`, `src/routes/__root.tsx` (fontes), `src/components/app-shell.tsx`, `src/lib/areas.ts` e os componentes de UI citados. Sem mudanças de schema — as colunas necessárias (`preferred_days`, `ideal_block_id`) já existem.
