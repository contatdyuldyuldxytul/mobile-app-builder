## 1. Hoje — colchetes de 2h com tamanho fixo

Hoje o colchete cresce conforme o número de atividades e o arraste reordena a lista inteira (por isso as atividades "pulam" para outro colchete).

Mudanças em `src/components/day-checklist.tsx`:

- O dia passa a ser dividido em **faixas fixas de 2h** a partir do início do dia (06:00–08:00, 08:00–10:00, …). Toda faixa tem **a mesma altura visual**, independente de quantas atividades tem dentro.
- As atividades dentro de uma faixa **encolhem para caber**: altura do cartão calculada pela quantidade de itens (1 item = cartão cheio; 2–3 = médio; 4+ = compacto, com ícone menor e horário em linha única). Abaixo de um mínimo legível, o restante vira um contador ("+2").
- Pausas continuam **fora** dos colchetes, em cartão fino tracejado.

```text
┌ Foco 08:00–10:00 ─────────────┐   altura fixa
│ [icon] Trabalho     08:00      │
│ [icon] E-mails      09:00      │   cartões encolhem
│ [icon] Leitura      09:30      │   conforme a lotação
└────────────────────────────────┘
· Pausa 15min ·                     (fora do colchete)
```

## 2. Arraste para dentro do colchete

- Cada colchete vira uma **zona de soltura** (`useDroppable`). Ao arrastar, o colchete sob o dedo **brilha** (anel/borda destacada + fundo suave) sinalizando "solte aqui".
- Ao soltar, a atividade é **inserida naquela faixa de 2h**, na posição indicada, e só as atividades daquela faixa são reagendadas — as demais faixas não se movem.
- O arraste continua otimista (a tela responde na hora) e só depois grava.

Ajuste em `src/lib/day-schedule.ts`: nova função de reposicionamento por faixa (`moveToSlot`) que recalcula os horários apenas dentro da faixa de destino, empurrando o excedente para a próxima faixa livre em vez de embaralhar o dia todo.

## 3. Mensal + Hábitos numa aba só

- A tela `mensal.tsx` ganha uma seção **Hábitos** abaixo das metas: grade do mês por hábito (marcações do mês), streak, nível e o marcar/desmarcar de hoje — reaproveitando a lógica que já existe em `habitos.tsx`.
- A lógica de hábitos sai da rota e vai para um componente reutilizável (`src/components/habits-panel.tsx`), usado pelo Mensal.
- A rota `/habitos` é removida e passa a redirecionar para `/mensal`.

## 4. Nova aba: Desafios (competição com amigos)

Substitui "Hábitos" na barra inferior. Estilo GymRats: desafios com data de início e fim, ranking por **% do dia concluído**, entrada por **código/link de convite**.

Telas:
- **Lista**: desafios ativos e encerrados, com sua posição no ranking.
- **Criar desafio**: nome, data de início, data de fim → gera código de 6 caracteres e link para compartilhar.
- **Entrar**: campo para colar o código (ou abrir o link direto).
- **Detalhe**: pódio + ranking com avatar/nome, média de % do dia no período, dias registrados, e faixa de destaque para você. Confete quando você lidera.

### Banco de dados (migração)
- `challenges`: id, owner_id, nome, código único, data início/fim, criado em.
- `challenge_members`: id, challenge_id, user_id, entrou em, único (challenge_id, user_id).
- `challenge_scores`: challenge_id, user_id, date, pct_completo, minutos_feitos — gravado quando você marca blocos no Hoje.
- Função `has_challenge_member(challenge_id, user_id)` com SECURITY DEFINER para as políticas não entrarem em recursão.
- RLS: você lê os desafios de que participa e os dados dos membros desses desafios; escreve só as suas próprias linhas. GRANTs para `authenticated` e `service_role`.
- Entrada por código através de uma função de servidor que valida o código e insere o membro (o código não expõe a lista de desafios de ninguém).
- O score do dia é atualizado sempre que um bloco é marcado como feito no Hoje.

### Navegação
`src/components/app-shell.tsx`: Hoje · Semana · Mensal · **Desafios** · Ajustes.

## Detalhes técnicos
- Zonas de soltura com `useDroppable` do `@dnd-kit/core` (já instalado), estado `over` para o brilho.
- Alturas dos cartões por classe utilitária baseada na densidade da faixa — sem cálculo em pixels por duração.
- Nome exposto no ranking vem de `profiles.display_name`; nenhum outro dado pessoal é compartilhado.
- Nova rota em `src/routes/_authenticated/desafios.tsx` com `head()` próprio.
