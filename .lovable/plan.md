## Duas regras novas no app

**1. Sempre horas por DIA (nunca por semana)**
**2. Zero sliders de arrastar** — e nada de listas com rolagem lateral (as barras cinzas das imagens somem)

---

### O que muda

**Onboarding — passo Âncoras**
- Sono: hoje é um slider. Vira um seletor de toque: botões `−` / `+` de 15 em 15 minutos com o valor grande no meio (ex.: "7h30 por noite"), mais 3 atalhos rápidos (6h30 / 7h30 / 8h).
- Trabalho ou estudo: mesmo controle `−`/`+` em horas por dia.
- Textos: remover "…h/semana". Mostrar só "por noite" / "por dia útil".
- Os dias da semana (Seg…Dom) passam a ser uma grade de 7 botões que cabem na largura da tela, sem rolagem horizontal.

**Onboarding — passo Distribuir horas**
- Cada área deixa de ter slider. Passa a ter: `−` / `+` em passos de 30 min, valor em **horas por dia**, e os dias em que acontece (grade de 7 botões).
- O painel de saldo mostra o restante em **horas por dia** ("sobram 2h30 por dia"), com o total da semana só como linha secundária pequena, opcional.

**Passo Semana ideal (pré-visualização)**
- A tira de dias vira grade de 7 botões, sem rolagem lateral.
- Resumo do dia continua em horas do dia (já está correto).

**Tela Âncoras (`/ancoras`)**
- Mesmos controles `−`/`+`; rótulos passam a "Sono: 7h30 por dia" e "Trabalho: 8h por dia útil", sem o "(…h/semana)".

**Tela Semana (orçamento)**
- Já é entrada em horas/dia; ajusto a linha de resumo para dar destaque ao valor por dia e deixar o total semanal discreto, e substituo o campo de texto por `−`/`+` com o mesmo padrão.

**Componente Slider**
- `src/components/ui/slider.tsx` deixa de ser usado em qualquer tela do app.

### Detalhes técnicos
- Novo componente reutilizável `src/components/ui/step-number.tsx`: botões `−`/`+` com área de toque de 44px, `step` configurável, valor formatado em `h`/`min`, seguro para toque (sem `pointermove`).
- Novo componente `src/components/ui/day-picker-week.tsx`: 7 botões em `grid-cols-7`, sem `overflow-x`.
- A conversão para o banco continua em horas semanais (`default_weekly_hours` = horas/dia × nº de dias); só a interface muda.
- Nenhuma alteração de schema.
