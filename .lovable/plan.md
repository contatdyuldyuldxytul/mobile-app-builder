## Objetivo

Adicionar uma camada visual de gamificação calma ao Redima: a Ampulheta como rosto do app e sete guardiões que refletem — sem números — se a pessoa está honrando o próprio tempo. Nada é armazenado: todo estado é calculado na hora a partir dos dados que já existem.

## Arte

Os 8 SVGs enviados (ampulheta, sol, check, alvo, montanha, nuvem, folha, caderno) vão para `public/personagens/`, servidos por caminho literal. Estrela e Balão ainda não existem: a Estrela usa temporariamente a arte do Sol com tratamento luminoso, e o Balão usa a Ampulheta em miniatura — ambos trocados em uma linha quando os arquivos chegarem.

Quatro estados por personagem, aplicados como filtro CSS sobre o SVG inteiro:

```text
adormecido  grayscale alto, opacidade baixa, sem brilho
desperto    grayscale leve, cor voltando
firme       cor plena
radiante    cor plena + leve saturação e halo suave
```

Transições longas e suaves (sem pulos, sem confete, sem som).

## Como o estado é derivado

Um módulo novo (`src/lib/guardioes.ts`) lê janela móvel de 7–14 dias e devolve `{ id, estado, frase }` por personagem. Nada de tabela nova, nada de pontuação salva.

- **Ampulheta** — areia = proporção honrada do orçamento da semana (planejado × realizado por área). Vira automaticamente na virada da semana; o texto é sempre "a ampulheta virou", nunca sequência quebrada.
- **Sol** — intenção do dia definida (`daily_plans.intention`) e primeiro bloco da manhã concluído.
- **Check** — aderência planejado × realizado nos blocos + `honored_budget` dos check-ins.
- **Alvo** — `focus_sessions` concluídas dentro do ciclo previsto.
- **Montanha** — progresso das metas do mês (`goals`).
- **Nuvem** — pausas de fato tiradas (blocos `pausa` concluídos + sessões com `took_break`).
- **Folha** — consistência entre semanas: apareceu perto do combinado, várias semanas seguidas.
- **Caderno** — check-in semanal preenchido.
- **Estrela** — só em conquista real: meta concluída ou primeira semana inteira honrada.

**Equilíbrio, não acúmulo:** exceder muito o orçamento de uma área marca aquele guardião como *sobrecarregado* (tratamento visual distinto, não superior) e derruba os guardiões das áreas de onde o tempo saiu. Consistência conta mais que volume.

**Recuperação barata:** a janela é móvel de 7 a 14 dias, então um ou dois dias de atenção já reacendem um guardião adormecido. Nunca há morte, derrota, contagem de dias perdidos ou notificação de perda.

## Onde aparecem

- **Hoje** — a Ampulheta no topo (substituindo/abraçando o anel de progresso atual) e no máximo **um** guardião, o mais relevante do momento, com uma frase curta que cita o que a pessoa fez de fato.
- **Barra de pausa** — a Nuvem surge quando chega a hora da pausa.
- **Check-in do dia** — o Check reage ao fechamento do dia.
- **Revisão semanal** (modo semanal do check-in) — o ecossistema completo: os sete guardiões em grade + a Ampulheta virando. Tela mais caprichada da camada; deixa óbvio qual área está adormecida.
- **Conquistas** — a Estrela, rara.

## Desafios

O placar ordenado por percentual sai. No lugar, os balões dos participantes ficam lado a lado numa faixa de céu, cada um numa altura proporcional ao quanto aquela pessoa honrou o próprio tempo — mesmo dado, sem ranking nem posição. Convite por código curto e link permanecem como estão.

## Restrições respeitadas

Nenhum número de gamificação visível; sem XP, níveis ou "faltam X". Movimento sutil apenas. Frases sempre referentes ao que a pessoa fez. Paleta, tipografia e o modelo em cascata permanecem intactos — a camada só lê.

## Detalhes técnicos

- `src/lib/guardioes.ts` — cálculo puro + hook `useGuardioes()` compondo os hooks existentes de `src/lib/data.ts` (sem query nova ao banco).
- `src/components/personagem.tsx` — renderiza `<img>` do SVG com o filtro do estado e acessibilidade (`alt` descritivo).
- `src/components/ampulheta.tsx` — Ampulheta com nível de areia e animação de virada de semana.
- `src/components/guardioes-grid.tsx` — ecossistema da revisão semanal.
- Edições: `hoje.tsx`, `break-bar.tsx`, `checkin-dialog.tsx`, `desafios.tsx`.
- Zero migração de banco.
