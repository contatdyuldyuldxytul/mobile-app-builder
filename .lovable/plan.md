## O conceito

Hoje o app tem camadas de tempo (âncoras → orçamento → semana ideal → dia), mas falta a **coisa que a pessoa realmente faz**: a tarefa. A proposta é introduzir a tarefa como unidade central e usar o Kanban como a mesa de trabalho da semana.

Minha sugestão para o Kanban (você pediu para eu sugerir): **tarefa com duração estimada**. É o que conecta tudo — sem duração, arrastar uma tarefa para segunda não diz nada ao orçamento; com duração, o app sabe se segunda já está cheia, encaixa a tarefa num horário livre e insere as pausas.

```text
META MENSAL  ──►  TAREFA (área + duração)  ──►  DIA DA SEMANA  ──►  BLOCO NA AGENDA
   (por quê)          (o quê)                    (quando, grosso)     (quando, exato)
```

## Kanban semanal — "Mesa da semana"

Três estados por tarefa: `backlog` (a fazer nesta semana, sem dia), `agendada` (tem dia) e `feita`.

No celular (padrão, um dia por vez):
- Barra de dias no topo: `S T Q Q S S D` com um pontinho de carga (verde/âmbar/vermelho) por dia.
- Abaixo, a coluna daquele dia: lista de cartões, arrastáveis para reordenar. Swipe lateral troca de dia.
- Cartão: título, duração, bolinha da área, e um botão "mover" que abre um seletor de dia (mais confiável que drag entre colunas no toque).
- Gaveta inferior "Backlog da semana": puxa para cima, arrasta um cartão para o dia atual.
- Rodapé fixo do dia: `4h30 de 6h disponíveis` + aviso quando estoura.

No desktop: as 7 colunas lado a lado + coluna de backlog à esquerda, drag entre colunas.

## Distribuição automática nos dias

Botão **"Distribuir semana"** no backlog. O algoritmo:
1. Ordena por prioridade da meta ligada, depois por prazo.
2. Para cada tarefa, procura o primeiro dia com horas livres suficientes na área correspondente (respeitando o orçamento semanal e a semana ideal já existentes).
3. Não empurra nada para dias já cheios — o que não couber fica no backlog com o aviso "não cabe nesta semana", que é exatamente o princípio "que o seu sim seja sim".

Dentro do dia, ao agendar, o app aloca a tarefa no primeiro intervalo livre da agenda e grava um `time_block` ligado à tarefa.

## Pausas — por bloco (sua escolha)

Cada bloco tem um modo de pausa: `permite pausa` (padrão) ou `sem pausa` (reunião, atendimento presencial, aula).
- Ao criar um bloco de trabalho com mais de 2h e modo "permite pausa", o app **fatia** o bloco: 2h de trabalho + 15 min de pausa + resto. A pausa aparece na agenda como um bloco próprio, visualmente leve.
- Duração da pausa (15/20/30 min) e o intervalo (padrão 2h) vêm dos ajustes já existentes.
- Blocos "sem pausa" ficam intactos, e o app sugere uma pausa logo depois que ele termina.
- No cronômetro de foco, ao completar 2h em blocos que permitem pausa, dispara o convite de descanso.

## Mensal alimenta o semanal

- Ao criar uma tarefa, campo opcional "meta" (lista das metas do mês, já presas a uma área).
- A meta ganha uma barra de progresso por **horas cumpridas** (soma dos blocos concluídos das tarefas ligadas) contra `target_hours`.
- Na tela mensal, cada meta ganha o botão "Criar tarefa da semana", que já vem com área e meta preenchidas.
- Na abertura da semana, um aviso gentil: "Meta X não tem nenhuma tarefa nesta semana."

## Navegação (enxugando)

O menu hoje tem 8 itens, demais para celular. Proposta de agrupamento:
- **Hoje** — intenção, agenda do dia, foco, hábitos.
- **Semana** — Kanban (aba principal) + Orçamento + Semana ideal como abas internas.
- **Mensal** — metas e progresso.
- **Revisão** — fim de dia/semana.
- **Ajustes** — âncoras, áreas, hábitos, preferências.

Barra inferior no celular com 5 ícones apenas.

## Detalhes técnicos

Banco (migração):
- Nova tabela `tasks`: `title`, `notes`, `domain_id`, `goal_id` (opcional), `estimated_minutes`, `weekly_plan_id`, `scheduled_date` (nulo = backlog), `sort_order`, `status` (backlog/agendada/feita), `allows_break`, `priority`. RLS por `auth.uid()` + GRANTs.
- `time_blocks`: coluna `task_id` e `block_kind` (`tarefa` | `pausa` | `livre`), e `allows_break`.
- `settings`: `break_duration_minutes` (o intervalo de 2h já existe como `break_interval_minutes`).

Front-end:
- `src/lib/scheduler.ts` — distribuição de tarefas nos dias, busca de intervalo livre, fatiamento com pausas. Lógica pura e testável, reaproveitando `findOverlaps` e `hoursBetween`.
- `src/lib/data.ts` — hooks `useTasks`, `useTaskMutations`.
- Nova rota `/semana` com abas (Kanban / Orçamento / Semana ideal), absorvendo `semanal.tsx` e `semana-ideal.tsx`.
- `src/components/kanban/` — `DayStrip`, `TaskCard`, `BacklogSheet`, `MoveToDaySheet`. Drag com `@dnd-kit` (suporte a toque), com fallback sempre disponível pelo seletor de dia.
- `app-shell.tsx` — barra inferior de 5 itens no celular.

Ordem de execução: migração → scheduler + hooks → tela `/semana` com Kanban → pausas automáticas na agenda diária → vínculo com metas mensais → navegação.
