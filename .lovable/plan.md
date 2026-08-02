## O que muda

Uma camada nova de animação. Nenhuma tela é redesenhada e `guardioes.ts` não é tocado.

### 1. Os vídeos

Os sete arquivos (check, ampulheta, nuvem, sol, montanha, folha, caderno) entram no app com esses mesmos nomes. Cada um traz o personagem em cima e a máscara de transparência embaixo, com áudio embutido.

### 2. Como aparecem

- Um componente novo desenha as duas metades num `<canvas>`, quadro a quadro, usando a metade de baixo como transparência da de cima. O `<video>` fica oculto e só carrega no momento de exibir.
- Ao disparar: a tela atual ganha desfoque com leve escurecimento e o personagem aparece na frente, centralizado, sem card e sem moldura.
- Ao terminar, desfoque e personagem somem juntos, suavemente. Tocar em qualquer lugar fecha antes. Nada bloqueia o uso do app.
- Tenta tocar com som; se o navegador recusar, muta e toca de novo — a animação nunca deixa de aparecer.

### 3. Som

Novo interruptor **Sons dos guardiões** na aba Eu, ligado por padrão. Desligado, toca sempre sem som.

### 4. Quando cada um aparece

| Guardião | Gatilho |
| --- | --- |
| Check | 100% dos blocos do dia concluídos (uma vez por dia) |
| Nuvem | todas as pausas do dia cumpridas |
| Sol | 5 manhãs seguidas com intenção definida |
| Montanha | meta do mês concluída |
| Folha | 4 semanas seguidas honrando o orçamento |
| Caderno | revisão semanal concluída (só na tela de revisão) |
| Ampulheta | ao fechar a revisão semanal |

### 5. Raridade

- No máximo um guardião por dia; empate no mesmo dia mostra o mais raro (ordem: Ampulheta > Folha > Montanha > Sol > Caderno > Nuvem > Check).
- Nunca em dois dias seguidos, exceto o Check.
- Intervalo mínimo: Nuvem 10 dias, Sol 14 dias, Folha 30 dias.
- Cada exibição fica registrada por usuário, então recarregar a página não repete a mesma.

Sem confete, sem número, sem tela de derrota.

## Detalhes técnicos

- **Banco (uma migração)**: tabela `guardian_appearances` (`id`, `user_id`, `guardiao text`, `shown_on date`, `created_at`, único por `user_id + guardiao + shown_on`), com GRANT para `authenticated`/`service_role`, RLS ligada e políticas escopadas em `auth.uid()`. Em `settings`, coluna `guardian_sounds_enabled boolean not null default true`.
- **Arquivos**: os sete MP4 sobem como assets de CDN (`lovable-assets`), com pointers em `src/assets/personagens/<nome>.mp4.asset.json`, evitando ~1,6 MB de binário no repositório; um mapa `VIDEO[id]` resolve as URLs. Se preferir os arquivos literalmente em `public/personagens/`, basta dizer.
- **Componentes novos**: `src/components/guardiao-overlay.tsx` (canvas + composição alfa via `drawImage` das duas metades e `globalCompositeOperation`, `requestAnimationFrame`, `playsInline`, `preload="none"`, retry mutado no `NotAllowedError`) e `src/components/guardiao-provider.tsx` montado uma vez em `app-shell.tsx`, expondo `dispararGuardiao(id)`.
- **Lógica nova** em `src/lib/guardiao-triggers.ts`: avaliação dos gatilhos a partir dos hooks já existentes (`useTimeBlocks`, `useDailyPlan`, `useGoals`, `useTimeBudgets`, `useCheckinsRange`) e aplicação das regras de raridade contra `guardian_appearances`; hooks de leitura/gravação em `src/lib/data.ts`.
- **Pontos de disparo**: `src/routes/_authenticated/hoje.tsx` (Check, Nuvem, Sol, Folha), `src/routes/_authenticated/mensal.tsx` (Montanha), `src/components/checkin-dialog.tsx` (Caderno na conclusão da revisão, Ampulheta ao fechar).
- `src/lib/guardioes.ts`, `challenges.ts` e o onboarding não são alterados.
