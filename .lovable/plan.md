## Problema

Hoje o agrupamento em `src/components/day-checklist.tsx` (`agruparEmFocos`) faz duas coisas erradas:

1. A faixa de 2h é ancorada no horário da **primeira atividade do dia**, não no relógio — por isso aparecem colchetes com rótulos estranhos e um bloco curto (almoço de 30min) ocupa um colchete inteiro sozinho.
2. Um bloco é atribuído inteiro à faixa em que **começa**. Trabalho das 08:00 às 12:00 (4h) cai num único colchete de 2h, embora dure o dobro.

## O que muda

**1. Grade ancorada no relógio**
Os colchetes passam a ser fatias fixas de 2h alinhadas a horas pares a partir do início do dia do usuário (ex.: 06:00–08:00, 08:00–10:00, 10:00–12:00…). Todo dia usa a mesma grade, independentemente de quando começa a primeira atividade.

**2. Blocos longos são fatiados entre colchetes**
Um bloco que atravessa a fronteira de uma faixa aparece como segmentos — 08:00–12:00 vira “Trabalho 08:00–10:00” no colchete das 8 e “Trabalho 10:00–12:00” no colchete das 10. Cada segmento mostra o horário real daquele pedaço e um marcador discreto de continuação. É recorte visual: o registro no banco continua sendo um único bloco, e concluir/excluir/dividir age no bloco inteiro (o mesmo `id`).

**3. Cartões proporcionais dentro do colchete**
A altura do colchete continua fixa (208px), mas cada cartão ocupa uma fração proporcional aos seus minutos dentro daquela faixa. Um almoço de 30min ocupa ~1/4 do colchete e o restante fica como espaço livre visível (área que aceita soltar uma atividade), em vez de o cartão esticar e fingir que preenche 2h.

**4. Colchetes vazios**
Faixas sem nenhuma atividade aparecem como colchete vazio discreto (“livre”), mantendo a leitura de linha do tempo e servindo de alvo de arraste. Faixas totalmente fora do dia (antes da primeira atividade / depois da última) não são renderizadas.

**5. Arraste**
O drop continua por faixa: soltar num colchete recoloca a atividade naquele intervalo. A chave de `id` para o dnd passa a ser o `id` do bloco apenas no **primeiro** segmento — segmentos de continuação não são arrastáveis, para não duplicar itens no sortable.

## Detalhes técnicos

- `agruparEmFocos` reescrito em `src/components/day-checklist.tsx`: recebe também `dayStart`/`dayEnd` (já disponíveis no `hoje.tsx` via perfil), gera as faixas por `Math.floor(min / 120)` no relógio e produz, para cada faixa, segmentos `{ block, ini, fim, primeiro, continua }` com interseção entre bloco e faixa.
- Pausas continuam fora dos colchetes, renderizadas na posição cronológica correta entre as faixas.
- `Colchete` distribui os segmentos com `flex-grow` proporcional a `(fim-ini)` e insere um espaçador para os minutos livres.
- `CartaoAtividade` passa a receber `ini`/`fim` do segmento em vez de ler direto do bloco, e ganha um estado compacto automático quando o segmento é curto (< 45min).
- Sem mudança de banco, de mutações ou da lógica de `src/lib/day-schedule.ts`.
