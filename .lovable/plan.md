## Objetivo

Trocar o controle de − / + por um slider de arrastar em todas as telas onde se escolhe horas, mantendo tudo em "horas por dia".

## O que muda

Um único componente novo (`HoursSlider`) substitui o atual `StepNumber` em todos os lugares:

```text
   7h30  por dia
 ●━━━━━━━━━━━━━━━━━━━━
 4h                 12h
```

- Valor grande em cima (ex.: `7h30`), slider largo embaixo, limites mínimos e máximos visíveis nas pontas.
- Passo de 15 min (0,25 h) onde hoje é 0,25, e 30 min onde hoje é 0,5 — mesmos limites atuais de cada campo.
- Polegar grande (44 px) para uso com o dedo, com feedback ao arrastar.
- O texto de horas continua no mesmo formato (`fmtHoras`), então nada muda nos cálculos.

## Onde é aplicado

- Onboarding, passo 2: sono por noite e trabalho/estudo por dia.
- Onboarding, passo 4: horas por dia de cada área da vida.
- Tela de Âncoras fixas: sono e trabalho.
- Orçamento da semana: horas por dia de cada área.

Os atalhos de toque existentes (6h30 / 7h30 / 8h no sono) e a grade de dias da semana continuam como estão — só o número de horas volta a ser arrastado.

## Detalhes técnicos

- Criar `src/components/ui/hours-slider.tsx` usando o `Slider` (Radix) já presente em `src/components/ui/slider.tsx`, exportando a mesma API de `StepNumber` (`value`, `onChange`, `step`, `min`, `max`, `suffix`) para troca direta.
- Manter `fmtHoras` exportado de onde está hoje para não quebrar imports.
- Substituir os usos em `onboarding.tsx`, `ancoras.tsx` e `week-budget.tsx`; remover `step-number.tsx` depois que não houver mais referências (mantendo `fmtHoras` em `src/lib`).
- Garantir que o slider não gere rolagem horizontal na largura de 393 px.
