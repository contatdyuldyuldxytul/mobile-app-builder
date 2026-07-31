## O que está acontecendo (confirmado)

Ao mexer no slider de uma área na aba "Semana", duas coisas derrubam o valor para zero:

1. **O ajuste automático come tudo.** Hoje o app força o dia a caber num teto (24h − sono − refeições − pausas) e, para isso, reduz proporcionalmente as áreas flexíveis. No seu caso, "Trabalho" está como âncora com 10h/dia nos 7 dias e "Dormir" com 7,5h/noite; sobram ~3h/dia para todas as outras áreas. Como as âncoras não cedem nada, as áreas flexíveis são espremidas até 0 — e, quando não há mais de quem tirar, a própria área que você acabou de mexer é zerada.
2. **A tela se recarrega por cima do que você fez.** Cada salvamento automático recarrega áreas e orçamento e reconstrói o estado da tela aplicando de novo esse mesmo aperto (agora sem proteger nenhuma área), sobrescrevendo o valor recém-escolhido.

Isso também deixou o banco inconsistente: várias áreas (Academia, Família, Saúde, Fé, Amigos, Estudos) estão com "horas semanais" 0 na área, mas com horas no orçamento da semana.

## Correção

**1. Nunca zerar a área que você está mexendo**
- A área tocada passa a ser intocável no ajuste: o slider respeita exatamente o valor escolhido.
- O limite máximo do slider passa a ser o que realmente cabe (folga do dia + horas atuais da área), então não é possível pedir mais do que existe — em vez de aceitar e depois zerar.

**2. Âncoras também cedem, e existe um piso**
- Quando só sobram âncoras (Trabalho/Dormir) para ceder, elas cedem também, em último caso, em vez de esmagar as áreas flexíveis.
- Nenhuma área é reduzida abaixo de 0,25h por dia por ajuste automático; se ainda assim não couber, o app mostra o aviso de dia cheio em vez de zerar sozinho.

**3. A tela para de se sobrescrever**
- A reconstrução do estado a partir do servidor passa a acontecer só na carga inicial (ou quando muda a semana/lista de áreas), não a cada salvamento automático.
- O salvamento automático deixa de ser cancelado silenciosamente quando um dia estoura: ele salva o que dá e o aviso continua visível.

**4. Consistência do que é salvo**
- Áreas com 0 hora passam a gravar 0 tanto na área quanto no orçamento da semana (hoje o 0 só vai para a área e o orçamento fica com o valor antigo), acabando com a divergência atual entre as duas tabelas.

## Detalhes técnicos

- `src/components/week-budget.tsx`:
  - `encaixarNoTeto`: excluir sempre `protegido` das doadoras, adicionar piso de 0,25h, segunda passada incluindo âncoras como doadoras, e remover o fallback que subtrai o excesso da própria área protegida.
  - Efeito de sincronização (linha ~121): trocar as dependências para rodar apenas na primeira hidratação e quando o conjunto de IDs de áreas mudar (guardar `hidratado` em ref), em vez de a cada mudança de `budgets`/`domains`.
  - `salvar`: remover o `if (diasEstourados.length) return;` e fazer upsert de todas as áreas (inclusive `planned_hours: 0`) para alinhar `time_budgets` com `life_domains`.
  - `teto` do slider: manter o cálculo por folga, garantindo `max >= value`.
- Nenhuma migração necessária; os valores divergentes se corrigem no primeiro salvamento após a correção.
