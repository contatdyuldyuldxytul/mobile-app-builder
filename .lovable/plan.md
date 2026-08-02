## O que já existe

- A tabela `guardian_appearances` (usuário, guardião, data, com RLS) já está criada no banco — nenhum código a usa ainda.
- `settings` já tem a coluna `guardian_sounds_enabled` (ligada por padrão) — falta o interruptor na tela.
- Os sete `.webp` animados foram enviados. Os áudios enviados são `.mp4` (áudio em contêiner MP4, não `.m4a`) — funcionam igual no navegador; usarei esses mesmos arquivos com os nomes correspondentes.

## Como vai aparecer

Um overlay em tela cheia: fundo com desfoque e leve escurecimento, personagem centralizado, sem card e sem moldura. A animação toca uma vez; ao terminar, personagem e desfoque somem juntos com uma transição suave. Tocar em qualquer lugar fecha antes. O overlay não bloqueia nada crítico e nunca reaparece ao recarregar (o registro em banco garante isso).

O arquivo do guardião só é buscado no instante em que ele vai aparecer — nada entra no carregamento do app.

## Som

O áudio toca junto com a animação, respeitando o interruptor **Sons dos guardiões** (novo, na aba Eu, ligado por padrão). Se o navegador bloquear o autoplay, o erro é engolido e a animação segue em silêncio.

## Quando cada guardião dispara

- **Check** — 100% dos blocos do dia concluídos (uma vez por dia).
- **Nuvem** — todas as pausas do dia cumpridas.
- **Sol** — 5 manhãs seguidas com intenção definida.
- **Montanha** — meta do mês concluída.
- **Folha** — 4 semanas seguidas honrando o orçamento.
- **Caderno** — revisão semanal concluída (só na revisão).
- **Ampulheta** — ao fechar a revisão semanal.

## Raridade

Antes de exibir, o app consulta o histórico do usuário e aplica, nesta ordem: no máximo um por dia; nunca em dois dias seguidos (exceto Check); intervalo mínimo de 10 dias (Nuvem), 14 (Sol) e 30 (Folha). Se dois gatilhos baterem no mesmo dia, vence o mais raro (Folha > Montanha > Sol > Ampulheta > Caderno > Nuvem > Check). A exibição só acontece depois que o registro é gravado, então recarregar não repete.

## Detalhes técnicos

- Mídia: os 14 arquivos entram como ponteiros de asset em `src/assets/guardioes/` (CDN), importados sob demanda com `import()` no momento do disparo — evita 17 MB de binários no repositório e garante o carregamento tardio pedido.
- `src/components/guardiao-overlay.tsx`: overlay (`fixed inset-0`, `backdrop-blur`, camada escura translúcida), `<img>` do webp, `<audio>` criado em runtime, timer de encerramento pela duração do clipe e fade de saída.
- `src/lib/guardiao-trigger.ts`: hook `useGuardiaoTrigger()` que recebe os gatilhos avaliados, consulta/insere em `guardian_appearances` (via `supabase`) e devolve qual guardião mostrar; hospeda a tabela de raridade e intervalos. `guardioes.ts` não é tocado.
- Avaliação dos gatilhos usando os hooks já existentes em `src/lib/data.ts` (blocos do dia, pausas, `daily_plans.intention`, `goals`, `daily_checkins.honored_budget`).
- Montagem: `hoje.tsx` (Check, Nuvem, Sol, Montanha, Folha) e `checkin-dialog.tsx` (Caderno ao salvar a revisão, Ampulheta ao fechá-la).
- `eu.tsx`: novo switch "Sons dos guardiões" gravando `settings.guardian_sounds_enabled`.
- Sem confete, sem números, sem tela de derrota; nenhuma migração nova é necessária.
