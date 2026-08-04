# Corrigir definitivamente a cascata Semana → Hoje

## Diagnóstico confirmado

- **Academia ou esportes** está salva com 1h por dia, período **Noite** e dias `[0,1,2,3,4,5,6]`, mas a Semana Ideal atual só criou a atividade no sábado e domingo.
- O gerador reserva primeiro 10h diárias de trabalho vindas de `settings`, embora a área Trabalho tenha outro total salvo. Isso ocupa a noite antes de tentar encaixar Academia nos dias úteis.
- As quatro refeições existem na Semana Ideal em todos os dias. Porém, ao montar o Hoje, a limpeza e a importação descartam blocos não-pausa menores que 30 minutos; por isso Café da manhã (20 min) e Lanche (15 min) somem. Jantar também é perdido quando entra em conflito com blocos antigos/orfãos.
- Alterações na aba Semana regeneram a Semana Ideal, mas não substituem imediatamente os blocos automáticos já existentes no Hoje. Assim, a tela continua mostrando uma versão antiga.

## Implementação

1. **Uma única fonte de verdade para horas e dias**
   - Fazer a reconstrução usar as horas/dias atuais de `life_domains` e do orçamento semanal também para Trabalho, eliminando a divergência com o valor antigo de `settings.work_hours_per_day`.
   - Manter Sono, refeições e pausas como reservas automáticas; todas as demais áreas seguirão exatamente `preferred_days`, `preferred_period` e `blocks_per_day`.

2. **Garantir atividades em todos os dias selecionados**
   - Alterar a ordem de alocação para reservar primeiro cada atividade configurada nos dias/períodos escolhidos e depois preencher a carga flexível de Trabalho nos espaços restantes.
   - Se “Todos os dias” estiver selecionado, gerar uma ocorrência em cada um dos sete dias, sem reduzir silenciosamente para apenas os dias em que sobrou espaço.
   - Manter cada atividade dentro do período escolhido e de um único colchete de 2h.

3. **Manter todas as refeições, todos os dias**
   - Tratar Café da manhã, Almoço, Lanche da tarde e Jantar como blocos automáticos válidos, mesmo quando durarem menos de 30 minutos.
   - Excluir refeições da regra de duração mínima aplicada às atividades comuns.
   - Preservar as quatro refeições em cada dia e reorganizar atividades ao redor delas, sem sobreposição.

4. **Atualização em tempo real da Semana para o Hoje**
   - Após autosave de horas, dias, período, frequência, refeições ou pausas, reconstruir o template e reconciliar imediatamente o dia atual.
   - Substituir somente blocos automáticos ainda não concluídos; preservar atividades manuais, tarefas ligadas e itens já concluídos.
   - Invalidar e atualizar os caches do Hoje somente depois da reconstrução terminar, evitando mostrar dados antigos durante o salvamento.

5. **Editor com autosave e recorrência explícita**
   - Remover o botão “Salvar alterações”.
   - Salvar automaticamente título, área, início, fim e conclusão, com debounce e estado visual discreto de salvando/salvo.
   - Adicionar a opção **“Definir esta atividade sempre para este horário”**.
   - Desligada: altera apenas o bloco de hoje. Ligada: cria ou atualiza o bloco correspondente na Semana Ideal para aquele dia da semana e mantém as próximas ocorrências nesse horário.
   - Manter validações de período, conflito, mínimo de 30 minutos para atividades comuns e limite do colchete.

6. **Limpeza e validação final**
   - Regerar a Semana Ideal e o Hoje com as regras corrigidas, removendo duplicatas e blocos automáticos órfãos conflitantes.
   - Validar no banco e na interface mobile que: Academia aparece à noite em todos os sete dias; o Hoje contém as quatro refeições; mudanças na Semana aparecem no Hoje sem botão manual; e o editor salva sozinho nos dois modos.

## Arquivos principais

- `src/lib/ideal-week.ts`: prioridade e garantia de alocação por dia/período; exceção correta para refeições.
- `src/lib/cascade.ts`: fonte única de orçamento, reconstrução e reconciliação do dia.
- `src/lib/day-schedule.ts`: preservação de refeições e encaixe sem conflito.
- `src/components/week-budget.tsx`: autosave aguardando a atualização completa do Hoje.
- `src/routes/_authenticated/hoje.tsx`: editor com autosave e opção de horário recorrente.