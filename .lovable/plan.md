## O que está acontecendo hoje (verificado no código)

**1. As pausas somem no "Hoje".**
A Semana Ideal até cria blocos "Pausa" (`src/lib/ideal-week.ts`, passo 4), mas quando o dia é gerado a partir do template (`generateDayFromTemplate` em `src/lib/cascade.ts`) o campo `block_kind` não é copiado. Resultado: a pausa entra no dia como se fosse uma atividade comum, ocupa espaço dentro do colchete de 2h e não aparece como pausa. Além disso, a pausa só é criada se o minuto exatamente seguinte ao bloco estiver livre — quando não está, ela é simplesmente descartada.

**2. Não dá para esticar bloco.**
A função de redimensionar existe (`saveBlockTime`), mas o novo checklist (`src/components/day-checklist.tsx`) só expõe arrastar para reordenar. Não há alça de redimensionamento.

**3. O dia não cobre tudo o que foi planejado na semana.**
Duas causas somadas:
- No gerador da Semana Ideal, área que não acha encaixe nas 3–4 tentativas de horário é silenciosamente descartada — nunca chega ao dia e nada avisa.
- "Completar com o orçamento" (`ensureDayBlocks`) só roda se você clicar, e ignora qualquer área que já tenha **um** bloco no dia, mesmo que faltem horas. Cobertura parcial nunca é completada.

## O que vou fazer

**Pausas a cada 2h, de verdade**
- Copiar `block_kind` (e `allows_break`) do template para o dia, para toda pausa nascer marcada como pausa.
- Tornar o posicionamento da pausa tolerante: se o instante seguinte ao bloco estiver ocupado, ela entra no próximo espaço livre dentro da mesma janela de 2h, em vez de sumir.
- Garantia no "Hoje": ao montar o dia, verificar cada faixa de 2h de atividade contínua; se fechou 2h sem pausa nem refeição, inserir a pausa com a duração definida na Semana (15–30min). Refeição continua contando como pausa.
- A duração vem sempre das configurações da semana (`break_duration_minutes` / `break_interval_minutes`).

**Esticar blocos arrastando**
- Alça de redimensionamento na borda inferior do cartão de atividade, com área de toque confortável no celular.
- Arrastar para baixo aumenta a duração em passos de 15 min; feedback ao vivo do novo horário enquanto arrasta.
- Ao soltar, salva via `saveBlockTime`, que já reacomoda os vizinhos para não sobrepor; blocos seguintes escorregam e as pausas são recalculadas.
- Também um ajuste rápido (+15/−15) no cartão expandido, para quem prefere tocar.

**Cobrir tudo o que foi planejado**
- Após gerar o dia pelo template, completar automaticamente com o que faltar do orçamento da semana (deixa de depender do clique manual).
- Corrigir a comparação: em vez de "essa área já tem algum bloco", calcular **minutos que faltam** para a área naquele dia e criar só a diferença.
- Painel "O que ficou de fora": lista das áreas/horas que não couberam no dia, com botão para empurrar o excedente ou reduzir — em vez de sumirem em silêncio (princípio "que o seu sim seja sim").
- Mesmo aviso no gerador da Semana Ideal, para você ver quando uma área não achou espaço.

## Detalhes técnicos

- `src/lib/cascade.ts`: `generateDayFromTemplate` passa a copiar `block_kind`/`allows_break`; `resetDayFromTemplate` idem.
- `src/lib/ideal-week.ts`: passo 4 (pausas) ganha fallback de encaixe; gerador retorna também as áreas não alocadas.
- `src/lib/day-schedule.ts`: nova `ensureBreaks(blocks, interval, duration)` idempotente; `ensureDayBlocks` passa a calcular déficit por área em vez de presença binária, e retorna o restante não alocado.
- `src/components/day-checklist.tsx`: alça de resize (pointer events, snap de 15min, `restrictToVerticalAxis` isolado do sortable), preview de horário durante o arraste.
- `src/routes/_authenticated/hoje.tsx`: encadeia template → completar orçamento → garantir pausas no efeito de montagem do dia; renderiza o painel de sobras; liga o `onResize` ao `saveBlockTime` com atualização otimista.
- Sem mudança de schema.
