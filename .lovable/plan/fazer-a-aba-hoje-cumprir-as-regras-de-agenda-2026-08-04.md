# Fazer a aba Hoje cumprir as regras de agenda

## Diagnóstico confirmado

- O cartão de pausa é apenas visual: `CartaoPausa` não recebe ação de concluir e não renderiza checkbox/check.
- A preferência manhã/tarde/noite é aplicada ao gerar a Semana Ideal, mas o preenchimento complementar do Hoje ignora `preferred_period` e usa a primeira vaga livre do dia.
- O fluxo tenta criar pausas depois de copiar atividades do template. Se uma atividade já atravessa o horário da pausa, a pausa é descartada por conflito em vez de a atividade ser reorganizada.
- A interface divide visualmente uma mesma atividade ao atravessar a fronteira de 2h, exibindo “(cont.)”; isso contradiz a regra de atividades inteiras dentro de um colchete.
- A montagem automática roda várias etapas independentes (copiar template, sanear, reservar pausas, completar orçamento e podar pausas), permitindo que dados antigos ou uma etapa posterior desfaçam a coerência da anterior.

## Correção

1. **Unificar a montagem do dia**
   - Criar uma única função determinística que transforme Semana Ideal + preferências + configurações em sessões fechadas de 2h.
   - Reservar primeiro as pausas configuradas de 15–30 minutos entre sessões.
   - Reorganizar blocos automáticos antigos que atravessam limites, preservando blocos concluídos ou criados manualmente.
   - Tornar a geração idempotente para recarregar a tela sem duplicar, apagar ou deslocar atividades.

2. **Respeitar manhã, tarde e noite em todos os caminhos**
   - Aplicar `preferred_period` tanto na Semana Ideal quanto no preenchimento complementar do Hoje.
   - Respeitar dias escolhidos, quantidade de aparições por dia e mínimo de 30 minutos.
   - Nunca usar uma vaga fora do período escolhido como fallback silencioso.

3. **Impedir atividades cortadas entre colchetes**
   - Cada bloco deve começar e terminar dentro da mesma sessão de 2h.
   - Quando uma duração for maior que a capacidade da sessão, criar blocos independentes, cada um com horário e check próprios, em vez de recortar visualmente o mesmo registro.
   - Ajustar arrastar e redimensionar para rejeitar ou realocar uma mudança que atravesse a pausa/limite da sessão.

4. **Transformar cada pausa em item marcável**
   - Manter a pausa fora dos colchetes, entre duas sessões.
   - Exibir botão circular de check, horário e duração.
   - Salvar/desfazer a conclusão usando o mesmo estado persistente dos demais blocos, sem contar a pausa como produtividade.

5. **Validar no celular e no banco**
   - Testar um dia real com áreas de manhã, tarde e noite, atividade longa, refeições e pausas configuradas.
   - Confirmar visualmente em 393×852 que cada pausa aparece entre colchetes e aceita check.
   - Recarregar a página e confirmar que checks, horários e ordem permanecem iguais, sem duplicatas nem atividades “(cont.)”.

## Critérios de aceite

- Há uma pausa marcável entre todas as sessões consecutivas de 2h que contêm atividades.
- A duração da pausa é exatamente a definida na Semana/Eu.
- Nenhuma atividade aparece fora do período escolhido para sua área.
- Nenhuma atividade é cortada visualmente entre dois colchetes.
- Nenhuma atividade automática tem menos de 30 minutos.
- Atualizar ou reabrir o Hoje não altera a agenda sozinho nem cria duplicatas.