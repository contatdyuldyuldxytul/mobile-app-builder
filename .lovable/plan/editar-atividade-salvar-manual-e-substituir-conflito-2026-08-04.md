# Editar atividade: salvar manual e substituir conflito

## O que muda

1. **Volta o botão "Salvar alterações"**
   - Remove o salvamento automático por tempo (debounce) do editor.
   - O botão fica no rodapé da folha, em destaque, e mostra "Salvando…" enquanto grava.
   - Fechar a folha sem salvar descarta as mudanças (comportamento esperado de um formulário com botão).

2. **Conflito de horário deixa de ser erro**
   - Some a mensagem "Esse horário já está ocupado por outra atividade ou pausa."
   - Ao salvar em cima de outra atividade/pausa, aparece uma confirmação nomeando o que está ali:
     "Trabalho ou estudo (10:00–12:00) já ocupa esse horário. Quer substituir?"
   - Se houver mais de uma sobreposição, todas são listadas por nome e horário.
   - Dois botões: **Substituir** (apaga o que estava e grava a atividade editada) e **Cancelar** (volta ao editor sem mudar nada).

3. **As demais validações continuam**
   - Nome obrigatório, mínimo de 30 min, dentro da janela do dia, dentro do mesmo colchete de 2h e dentro do período da área seguem bloqueando o salvamento com a mensagem atual.

## Detalhes técnicos

- `EditarBloco` em `src/routes/_authenticated/hoje.tsx`: remover o `useEffect` de debounce que chama `salvar`, adicionar `<Button onClick={salvar}>Salvar alterações</Button>`.
- A checagem de conflito passa a devolver a lista de blocos sobrepostos; em vez de `setErro`, guarda em estado e abre um `AlertDialog`/`Sheet` de confirmação com título e horários dos blocos.
- Confirmar chama `onSalvar` com os ids a remover; `editarBloco` em `hoje.tsx` recebe `substituir: string[]` e faz `delete().in("id", ...)` antes do `update`, mantendo a invalidação de `blocks`, `blocks-range` e `ideal-week`.
- "Definir esta atividade sempre para este horário" continua funcionando como hoje, aplicado no mesmo salvamento.
