## Objetivo

Deixar o onboarding curto, limpo e visual: nada de alimentação, pausas ou lembretes na tela — tudo isso o app calcula sozinho — e uma tela sem as abas de navegação do app.

## Novo fluxo: 4 passos (era 6)

1. Conectar agenda (igual hoje)
2. Âncoras: sono por noite + trabalho/estudo por dia com os dias marcáveis (igual hoje)
3. Áreas da vida (sem Alimentação e sem Pausas na lista)
4. Distribuir as horas livres (só as áreas escolhidas) + prévia visual da semana ideal, e botão "Concluir"

Removidos: o passo de lembretes/notificações e todo o bloco de sliders de alimentação e pausas.

## O que muda em cada ponto

**Passo 3 — Áreas**
- Tirar "Alimentação" e "Pausas" da lista de chips. Elas continuam existindo internamente, só somem da escolha do usuário.

**Passo 4 — Horas livres**
- Some o cartão "Antes das suas áreas, reservei o que todo dia consome" com os dois sliders e o texto explicativo.
- O cálculo de horas livres continua descontando alimentação e pausas por trás (valores padrão automáticos: ~1h30/dia de refeições e uma pausa de 15 min a cada 2h), só que sem exibir nada disso.

**Semana ideal — versão visual**
Hoje é uma lista longa de cartões com chips de área em cada bloco. Substituir por:
- Uma grade de 7 dias em abas/pílulas (Seg…Dom): toca no dia e vê só aquele dia.
- O dia aparece como uma faixa de horário das 06h em diante, com blocos coloridos pela cor da área, altura proporcional à duração e rótulo curto (horário + nome). Compacto, cabe na tela do celular.
- Blocos automáticos (refeições, pausas, sono/trabalho) aparecem apenas como contexto, sem chips de área e sem opção de reclassificar — nada de "escolher a área do Café da manhã".
- Só blocos realmente ambíguos (vindos da agenda, "A classificar") ganham um toque para escolher a área; os demais têm no máximo remover.
- Um resumo em uma linha no topo: total de horas por área naquele dia.

**Lembretes**
- Passo removido do onboarding. Os horários de check-in e o lembrete de pausa passam a usar os padrões atuais (07:30 / 21:00 / pausas ligadas) e continuam editáveis em Ajustes.

**Sem abas durante o onboarding**
- A rota de onboarding deixa de renderizar a casca do app: sem barra inferior de navegação no celular, sem menu lateral no desktop. Fica só o conteúdo do onboarding, com uma barra de progresso no topo.

## Detalhes técnicos

- `src/routes/_authenticated/route.tsx`: não envolver com `AppShell` quando a rota for `/onboarding` (usar `useRouterState` para detectar o caminho), mantendo a proteção de sessão.
- `src/routes/_authenticated/onboarding.tsx`: `TOTAL = 4`; remover o bloco de sliders de refeições/pausas e o passo de rituais; manter `refeicoes = REFEICOES_PADRAO` e `pausasDia = pausasSugeridasPorDia(...)` como constantes internas usadas no cálculo e em `gerarSemanaIdeal`; `saveRituals` continua sendo chamado com os padrões no `concluir()`.
- `src/lib/areas.ts`: manter as áreas Alimentação/Pausas (usadas pelo gerador e pelas cores), mas expor uma lista `AREAS_ESCOLHIVEIS` sem elas para os chips do passo 3.
- `src/components/onboarding/semana-ideal-preview.tsx`: reescrito como grade por dia com seletor de dia, blocos proporcionais com cor via `areaColor`, sem chips por bloco; ação de reclassificar só para `A_CLASSIFICAR`.
- Sem mudanças de banco de dados; o salvamento na cascata continua igual.
