## Objetivo

Deixar o topo da aba **Hoje** como a referência anexada: a frase do dia à esquerda e uma ilustração de montanha que muda conforme a hora do dia, à direita. Some o texto "Sexta-feira · seu dia montado..." e o bloco da Ampulheta.

## O que muda

**1. Ilustrações por horário (9 imagens enviadas)**

As imagens vão para o CDN de assets do projeto (não ficam pesando no código) e são escolhidas pela hora atual:

```text
05:00–06:59  Standart - 5AM   (lua, madrugada)
07:00–08:59  Standart - 7AM   (nascer do sol)
09:00–10:59  Standart - 9AM
11:00–12:59  Standart - 11AM
13:00–16:59  Standart - 1PM
17:00–18:59  Standart - 5PM   (pôr do sol)
19:00–20:59  Standart - 7PM
21:00–22:59  Standart - 9PM   (noite)
23:00–04:59  Standart - 11PM  (madrugada)
```

Não veio uma imagem de 3PM, então a faixa da tarde (13h–17h) usa a de 1PM, que é visualmente compatível. Se você mandar a de 3PM depois, é só encaixar.

A imagem é recalculada sozinha enquanto a tela fica aberta (verificação a cada minuto), então o app acompanha a passagem do dia sem precisar recarregar.

**2. Novo cabeçalho**

- Continua: a data por extenso e o título grande **Hoje**.
- Sai: a linha "Sexta-feira · seu dia montado a partir do que você reservou na Semana."
- Logo abaixo do "Hoje": um bloco com a frase do dia (texto + autor) ocupando a esquerda e a ilustração do horário à direita, encostada no canto, no mesmo espírito da referência.
- No celular a ilustração fica menor e ancorada à direita, com a frase fluindo ao lado — sem quebrar em duas linhas soltas.
- A seção separada da frase do dia (que hoje aparece mais abaixo, com a barra lateral colorida) é removida, já que a frase sobe para o cabeçalho.

**3. Ampulheta**

O bloco da Ampulheta na tela Hoje sai completamente. O restante da camada de guardiões (Estrela, guardião em destaque, Nuvem nas pausas) continua igual.

## Detalhes técnicos

- Upload das 9 PNGs via `lovable-assets`, gerando ponteiros `.asset.json` em `src/assets/horas/`.
- Novo módulo `src/lib/hora-do-dia.ts`: mapa faixa-horária → asset + `useIlustracaoDoDia()` com atualização por intervalo.
- Novo componente `src/components/hero-hoje.tsx`: frase + ilustração, responsivo.
- `src/routes/_authenticated/hoje.tsx`: remove subtítulo, `<Ampulheta>` e a seção antiga da frase; insere `<HeroHoje>`. `src/components/ampulheta.tsx` fica no projeto (ainda usado em outras telas, se houver) — verifico e removo se ficar órfão.
