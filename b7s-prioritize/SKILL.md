---
name: b7s-prioritize
description: Cierra el ciclo del trio b7s — cruza los TODOs vivos de `.brainstorms/` con los prompts ejecutables generados (auto-detecta vía glob, default `prompts/7xx-brainstorm-executables/`), calcula un score de prioridad por urgencia + dependencias + volumen de TODOs detrás + fecha del brainstorm origen, y entrega un ranked list de "los próximos 3-5 prompts a correr". Úsala cuando el usuario diga "qué prompt corro ahora", "qué tengo pendiente del brainstorm", "prioriza mis prompts", "qué sigue", "qué es más urgente", o cuando termine `/b7s-review` y necesite decidir el siguiente paso.
argument-hint: (opcional) `top-N` para limitar (default: 5), o slug específico para ver el detalle de un solo prompt
---

<objective>
Es el **tercer paso** del trio b7s:
1. `b7s-brainstorm` captura ideas en `.brainstorms/inbox/`
2. `b7s-review` revisa TODOs y los liga a prompts ejecutables
3. **`b7s-prioritize`** decide qué correr ahora — cruza brainstorms ↔ prompts ↔ urgencia

Es la skill anti-paralisis: cuando tienes 25 prompts ejecutables y no sabes por dónde empezar, esta los ranquea por una mezcla de urgencia + impacto + readiness.
</objective>

<context>
- Fecha de hoy: !`date +%Y-%m-%d`
- Brainstorms activos: !`ls .brainstorms/inbox/ .brainstorms/in-progress/ 2>/dev/null | grep -v ":$" | grep "\.md$" | wc -l | tr -d ' '` archivos
- Prompts ejecutables (no completados, default path): !`ls prompts/7xx-brainstorm-executables/*.md 2>/dev/null | wc -l | tr -d ' '` prompts
- Prompts completados (default path): !`ls prompts/7xx-brainstorm-executables/completed/*.md 2>/dev/null | wc -l | tr -d ' '` prompts
- Idioma de output: **español mexicano**
</context>

<process>

**Paso 1 — Verificar setup**

Si `.brainstorms/` no existe, dile al usuario:
> "No hay `.brainstorms/` en este workspace. Corre `/b7s-brainstorm` primero, luego `/b7s-review`, luego vuelve aquí."

Auto-detecta el directorio de prompts ejecutables. El default es `prompts/7xx-brainstorm-executables/`, pero si el usuario tiene otra convención (ej. `prompts/executables/`, `tasks/`, `runbooks/`), prueba primero el default y si está vacío busca con glob `prompts/**/brainstorm-executables/` o pídele al usuario que aclare.

Si no hay prompts ejecutables en ningún lado:
> "No hay prompts ejecutables todavía. Corre `/b7s-review` para que tus brainstorms produzcan prompts."

**Paso 2 — Recolectar inputs**

Lee los archivos en paralelo (Glob + Read):

a) **Brainstorms activos**: `.brainstorms/inbox/*.md` + `.brainstorms/in-progress/*.md`
   - De cada uno, parsea la sección `## 📌 TODOs`
   - Cada TODO con marca `(doing — prompt: <path>/NNN-slug.md)` se asocia al prompt NNN
   - TODOs con marca `(snoozed)` o `(cancelled)` se ignoran
   - TODOs sin prompt asociado son TODOs huérfanos (los reportas pero NO los rankeas)

b) **Prompts ejecutables**: archivos `.md` del directorio detectado (excluir `completed/`)
   - Para cada uno: lee el frontmatter o las primeras ~30 líneas
   - Extrae: `<objective>` (qué hace), referencias `prompt NNN` (dependencias)

c) **Categorías de prioridad explícita** del brainstorm de origen — busca en cada brainstorm los markers:
   - `🔥` o "Inmediatos" o "Urgente esta semana" → score base **100**
   - `🚀` o "Esta semana" o "momento ahora" → score base **70**
   - `🟡` o "Medium-term" → score base **40**
   - `🟢` o "Operativos vivos" → score base **60**
   - `⏭️` o "Aplazado" → score base **10** (probablemente no debería correr)

**Paso 3 — Calcular score de prioridad**

Para cada prompt no completado:

```
score = base_urgencia
      + (volumen_todos_detras × 5)        # cada TODO ligado suma 5
      + (cross_references_de_otros × 3)   # si otros prompts dependen, suma
      - (dependencias_no_ready × 30)      # si depende de prompt no ejecutado, resta
      - (edad_brainstorm_dias × 0.5)      # ligero decay (priorizar ideas frescas pero no agresivo)
```

Donde:
- `base_urgencia`: del paso 2c
- `volumen_todos_detras`: cuántos TODOs distintos del brainstorm apuntan a este prompt
- `cross_references_de_otros`: cuántas veces otros prompts mencionan a este como dependency upstream (busca patrones tipo "prompt 702" o "del 702")
- `dependencias_no_ready`: si el prompt menciona "Inputs upstream OBLIGATORIOS" o "depends on prompt NNN" y NNN aún no se completó (no está en `completed/`), penaliza

**Paso 4 — Calcular READINESS**

Independiente del score, marca cada prompt con:
- 🟢 **READY** — todas sus dependencias están completas o no tiene
- 🟡 **PARTIAL** — algunas dependencias listas
- 🔴 **BLOCKED** — depende de un prompt que aún no corre (típico: 702 desbloquea muchos)

**Paso 5 — Output ranked**

Si `$ARGUMENTS` está vacío o es un número (e.g. "5"), muestra el top-N (default 5):

```
🎯 Top 5 prompts a correr (de N totales)

#1 — prompt 720 — gheller-pos-backlog-cleanup            score: 142  🟢 READY
   📂 Cubre 5 TODOs del brainstorm 2026-05-06 (Acciones 3, 4, 5 + drag-drop + full-screen)
   🔥 Marcado "Esta semana" en el brainstorm
   ⚡ Sin dependencias upstream
   👉 Para correr: /run-prompt 720

#2 — prompt 702 — analisis-retrospectivo-canal-youtube   score: 138  🟢 READY
   📂 Cubre 1 TODO directo + es dependencia de 6 prompts (703, 705, 706, 708, 709, 711)
   🔥 Marcado "Esta semana" — fundación de la fábrica de contenido
   ⚡ Sin dependencias
   👉 Correrlo desbloquea 6 prompts más
   👉 Para correr: /run-prompt 702

#3 — prompt 719 — ui-pedidos-b2b-kickoff                 score: 110  🟢 READY
   📂 Cubre 2 TODOs (Acciones 1+2 del 2026-05-06)
   🔥 Marcado "Esta semana"
   ⚡ Pre-requisito de 720 (importar catálogo) y 726 (Ania ↔ pedidos)
   👉 Para correr: /run-prompt 719

#4 — prompt 703 — mvp-primer-video-manuel                score: 98   🔴 BLOCKED
   📂 Cubre 1 TODO ("MVP del primer video con Manuel")
   🚀 Marcado "Esta semana"
   ⚠️ Depende de: 702 (análisis canal) — no corrido todavía
   👉 Esperar a 702 antes de correr este

#5 — prompt 712 — avatar-ania-cuatro-frentes             score: 92   🟡 PARTIAL
   📂 Cubre 4 TODOs (los 4 frentes de Avatar Ania)
   🚀 Marcado "Esta semana"
   ⚠️ Depende parcialmente de 717 (OpenClaw reconfig — frente 3 vive en Hermes)
   👉 Puede arrancar frentes 1, 2, 4. El 3 espera a 717.
```

Si `$ARGUMENTS` es un slug o número específico (e.g. "720" o "ui-pedidos-b2b"), muestra detalle expandido de ese solo prompt: TODOs cubiertos, dependencias, score breakdown, suggested next step.

**Paso 6 — Reportar TODOs huérfanos**

Si encontraste TODOs activos sin prompt asociado, lístalos al final:

```
⚠️ TODOs activos sin prompt asociado (4)

📅 2026-05-05.md (3):
  - [ ] Tema Nayi — clasificado como personal, no procede prompt
  - [ ] Salesforce documentos — snoozed sin prompt (esperar carrera)

📅 2026-05-06.md (1):
  - [ ] Acción 12 — Las 300 preguntas Manuel — covered transitively por 702 + 706
```

**Paso 7 — Reportar prompts sin TODO**

Prompts ejecutables que NO están ligados a ningún TODO actual (probables huérfanos también):

```
🔍 Prompts sin TODO activo detrás (0)
```

(Si hay 0, mejor. Si hay muchos, sugieren que los brainstorms perdieron sincronía con los prompts.)

**Paso 8 — Sugerir próxima acción**

Dependiendo del top:

- Si #1 es 🟢 READY: "Te sugiero correr `/run-prompt {NNN}` ahora."
- Si #1 está 🔴 BLOCKED: "Antes de #1, hay que correr el dependency. Te sugiero `/run-prompt {dep_NNN}` primero."
- Si todos top-5 están 🔴 BLOCKED: "Todo está bloqueado por 1-2 fundaciones. Corre {NNN} primero (desbloquea N prompts)."

</process>

<edge_cases>
- **Path de prompts no estándar**: el default es `prompts/7xx-brainstorm-executables/`. Si está vacío, auto-detecta con glob `prompts/**/brainstorm-executables/` o `prompts/**/executables/`. Si pasa `$ARGUMENTS=path:<dir>`, usa ese directorio explícito.
- **Sin brainstorms pero con prompts**: ranquear solo los prompts (perdiendo el componente "volumen TODOs detrás" — fallback a edad + cross-references).
- **Prompts en categoría distinta**: por default solo escanea el directorio detectado. Si el usuario pasa `$ARGUMENTS=all`, escanea todas las categorías bajo `prompts/`.
- **Brainstorm sin sección `## 📌 TODOs`**: log warning y skip ese brainstorm, no romper.
- **TODO con prompt path roto** (apunta a un .md que no existe): listarlo en huérfanos con flag `BROKEN_LINK`.
- **Dependencias circulares**: si A depende de B y B depende de A, ambos quedan READY (resolver manualmente).
</edge_cases>

<success_criteria>
- Ranked list mostrado con score + readiness + razón
- TODOs huérfanos reportados (no ranqueados, pero no perdidos)
- Sugerencia clara de "qué correr ahora"
- Conversación en español mexicano
- No edita archivos — read-only analysis
</success_criteria>

<output>
- Ranked list en chat (no se persiste a archivo)
- Si el usuario lo pide explícitamente, puede guardar a `.brainstorms/.last-prioritization.md` para referencia
</output>
