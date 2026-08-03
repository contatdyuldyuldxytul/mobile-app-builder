## Correção da agenda gerada

### O que foi confirmado

- Em **Eu → Áreas da vida**, hoje só existe o seletor de período; os dias não podem ser editados nessa tela.
- O gerador percorre várias vagas livres e pode criar mais de um bloco para a mesma área no mesmo dia, contrariando a regra de uma atividade por área/dia.
- Ao regenerar a Semana Ideal, **Hoje** apenas tenta acrescentar os novos blocos. Os blocos automáticos antigos continuam no dia, causando horários desatualizados e repetições.

### Implementação

1. **Editar período e dias em Eu**
   - Adicionar o seletor semanal já usado pelo app em cada área da vida.
   - Salvar período e dias juntos sem redesenhar a seção.
   - Após cada alteração, aguardar a regeneração completa e mostrar erro real caso ela falhe.

2. **Gerar somente um bloco por área em cada dia**
   - Para cada área e dia escolhido, procurar a melhor vaga contínua dentro da janela obrigatória de manhã, tarde, noite ou tanto faz.
   - Criar no máximo um bloco, sempre com início e fim em múltiplos de 15 minutos e duração mínima de 15 minutos.
   - Se a duração inteira não couber, criar apenas o maior bloco possível e devolver o restante no aviso, sem fragmentar em outras vagas.

3. **Sincronizar a agenda de Hoje**
   - Durante a regeneração, substituir os blocos automáticos ainda não concluídos do dia atual pelos blocos do novo template.
   - Preservar blocos manuais, tarefas, blocos concluídos e alterações que não pertencem mais à geração automática.
   - Remover referências antigas ao template antes de recriá-lo, evitando registros órfãos ou falha ao apagar a Semana Ideal anterior.
   - Invalidar conjuntamente os caches da Semana Ideal e de Hoje para a mudança aparecer imediatamente, sem recarregar a página.

4. **Evitar a segunda fonte de duplicação**
   - Ajustar o complemento por orçamento em Hoje para reconhecer que a área já foi atendida pelo template.
   - Ele só poderá preencher uma área ausente; nunca criar novas fatias de uma área que já tem bloco naquele dia.

### Validação

- Alterar período e dias de uma área em Eu e confirmar a mudança imediata na Semana Ideal e em Hoje.
- Testar uma área que cabe inteira, uma que cabe parcialmente e uma que não cabe no período.
- Confirmar no celular que existe no máximo um bloco por área/dia e que blocos manuais ou concluídos não são apagados.
- Confirmar que repetir a regeneração não cria duplicatas.