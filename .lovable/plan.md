# Ajustes: onboarding, pausas e preferências por área

## 1. Passo 4 do onboarding igual à aba Semana
Hoje o passo 4 só soma horas e avisa quando estoura. Vai passar a usar a mesma
lógica auto-equilibrável da aba Semana: ao aumentar uma área, as outras cedem
proporcionalmente nos mesmos dias, respeitando o teto real do dia (24h − sono −
refeições − pausas). O máximo de cada slider passa a ser o que ainda cabe, então
não é mais possível ultrapassar as horas disponíveis da semana.

## 2. Blocos de 30 min e pausa entre colchetes
- Duração mínima de qualquer bloco de atividade passa de 15 para 30 minutos —
  na geração da semana ideal, no preenchimento do dia, ao redimensionar e ao
  dividir. Horários continuam redondos.
- A pausa passa a usar sempre a duração escolhida na aba Semana.
- Toda virada entre dois colchetes de 2h ganha uma pausa, mesmo quando o colchete
  seguinte tem poucas atividades. Ela aparece sempre fora dos colchetes, como
  divisória com check entre uma sessão e outra.

## 3. Período e repetição na aba Semana
Em cada área da aba Semana, acima da escolha dos dias:
- Período: Manhã / Tarde / Noite / Tanto faz (o mesmo campo que hoje só existe na
  aba Eu; os dois lugares ficam sincronizados).
- Repetição no dia: "uma vez" ou "duas vezes" — define se as horas do dia viram um
  bloco único ou dois blocos separados dentro do período escolhido.
Mudar qualquer um dos dois regenera a semana ideal na hora, como já acontece com as horas.

## 4. Remover o aviso "Não coube tudo em…"
O toast some da aba Semana e da aba Eu. O app agenda o que cabe, em silêncio. A
situação de dia cheio continua visível na barra de capacidade.

## Detalhes técnicos
- `src/routes/_authenticated/onboarding.tsx`: extrair `encaixarNoTeto` de
  `week-budget.tsx` para um módulo compartilhado e usar nos dois.
- `src/lib/ideal-week.ts`: mínimo de bloco 30 min em `por()`/`preencherEm()`;
  `preencherEm` passa a aceitar quantos blocos gerar no dia.
- `src/lib/day-schedule.ts`: passo de posicionamento continua 15, duração mínima
  vira 30; `ensureBreaks` garante pausa em cada fronteira de ciclo de 2h.
- Migração: nova coluna `blocks_per_day` (inteiro, padrão 1) em `life_domains`.
- `src/components/week-budget.tsx` e `eu.tsx`: novos controles e remoção do toast.