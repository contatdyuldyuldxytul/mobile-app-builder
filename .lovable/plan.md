# Corrigir períodos do Hoje e editar atividades

## Resultado esperado

- Uma área configurada como **Noite** só aparece a partir das 18h; **Manhã** termina até 12h e **Tarde** fica entre 12h e 18h.
- Blocos automáticos antigos fora do período deixam de contaminar o Hoje.
- Tocar em qualquer atividade abre um editor completo, sem confundir o toque com arrastar ou marcar como concluída.

## Implementação

1. **Validar todos os blocos automáticos antes de montar o dia**
   - Comparar cada bloco não concluído com o `preferred_period` atual da sua área.
   - Considerar inválido o bloco fora da janela escolhida, inclusive blocos antigos sem vínculo com a Semana Ideal.
   - Remover somente esses blocos automáticos inválidos e recriá-los a partir da Semana Ideal atual; preservar atividades concluídas e blocos criados/editados manualmente.

2. **Unificar a regra de período**
   - Centralizar as janelas Manhã/Tarde/Noite/Tanto faz em uma única função compartilhada pela Semana Ideal, preenchimento do Hoje e movimentação.
   - Impedir que geração, reorganização automática ou drag-and-drop salve uma atividade fora da preferência da área.
   - Manter as regras existentes de mínimo de 30 minutos, limite do colchete de 2h e pausas entre sessões.

3. **Regenerar corretamente quando a preferência mudar**
   - Ao mudar o período na Semana, reconstruir a Semana Ideal e substituir os blocos automáticos futuros incompatíveis.
   - No Hoje, fazer uma correção idempotente: uma execução organiza os dados e as próximas não ficam apagando/recriando blocos válidos.

4. **Editor ao tocar na atividade**
   - Substituir a expansão de ícones por uma folha inferior mobile-first ao tocar no conteúdo do cartão.
   - Permitir editar: título, área, horário inicial, horário final/duração e status de concluído.
   - Manter ações rápidas de duplicar, adiar, dividir e excluir dentro do editor.
   - Para atividades recorrentes, ao salvar perguntar **Só hoje** ou **Sempre**; “Sempre” também atualiza a Semana Ideal.
   - Validar conflito de horários, mínimo de 30 minutos, limite do colchete e período escolhido antes de salvar, com mensagem clara no próprio editor.

5. **Validação funcional no celular**
   - Confirmar com os dados atuais que “Academia ou esportes — Noite” aparece no horário noturno, nunca às 07:00, 12:45 ou 15:30.
   - Tocar, editar e salvar uma atividade; recarregar e confirmar persistência.
   - Testar “Só hoje” e “Sempre”, além de drag, check e pausa, garantindo que as interações não se confundem.

## Detalhes técnicos

- A preferência já está salva corretamente como `noite`, e a Semana Ideal atual já contém Academia às `20:15–21:15`.
- O defeito confirmado está nos registros antigos de `time_blocks` sem `ideal_block_id`: a montagem do Hoje contabiliza esses horários como válidos sem conferir novamente o período da área.
- A correção ficará na lógica compartilhada de agenda e na rota Hoje; não exige alteração de estrutura do banco.