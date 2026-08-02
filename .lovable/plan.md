## O que vou fazer

Adicionar um painel de teste na aba **Eu** para que você possa ver cada um dos 7 guardiões animados sob demanda, sem precisar reproduzir os gatilhos reais no banco.

## Como vai funcionar

- Na aba **Eu**, abaixo de "Seus guardiões", adicionar uma seção colapsada chamada **"Testar guardiões"**.
- Dentro dela, 7 botões em grade: Check, Nuvem, Sol, Montanha, Folha, Caderno, Ampulheta.
- Ao tocar em um botão, o overlay de animação correspondente abre imediatamente, com o mesmo desfoque, som e fade-out automático do comportamento normal.
- O teste **não grava** em `guardian_appearances` e **não aplica** as regras de raridade, para não interferir nas aparições reais.
- O som respeita o interruptor **"Sons dos guardiões"** já existente.

## Onde entra o código

- `src/routes/_authenticated/eu.tsx`: adicionar a seção de teste e o estado local que alimenta o `<GuardiaoOverlay>`.
- `src/components/guardiao-overlay.tsx`: garantir que o overlay aceite ser aberto por um prop de controle externo (já aceita; apenas confirmar que fecha corretamente).

## Restrições que mantenho

- Não altero `guardioes.ts`.
- Não altero `guardiao-trigger.ts` (a lógica real de gatilhos continua intacta).
- Não altero o onboarding nem as telas de Hoje/Semana/Mensal.
- O painel de teste pode ter uma flag simples de ambiente ou ficar sempre visível, já que a aba Eu é pessoal e não interfere no uso normal.

## Resultado esperado

Você toca em cada botão na aba **Eu** e vê o personagem com desfoque e som, podendo confirmar que todas as 7 animações e todos os 7 áudios estão carregando e exibindo corretamente.