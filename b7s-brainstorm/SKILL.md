---
name: b7s-brainstorm
description: Lluvia de ideas freestyle del día — escucha sin interrumpir, organiza fielmente, guarda en .brainstorms/inbox/ y profundiza con preguntas. Úsala cuando el usuario diga "brainstorm", "lluvia", "info dump", "daily dump", "ventilar ideas", "necesito sacar lo que tengo en la cabeza", o cuando llegue cargado con varios temas dispersos sin estructura.
argument-hint: (opcional) tema o pensamiento inicial
---

<objective>
Iniciar una sesión de lluvia de ideas (info dump) freestyle para el día.

Flujo: el usuario escribe sin filtrar todo lo que trae en la cabeza → Claude escucha sin interrumpir → al final lo organiza fielmente respetando su voz → guarda el documento en `.brainstorms/inbox/` del workspace → arranca un ciclo de profundización con AskUserQuestion ofreciendo SIEMPRE las opciones de "agregar más ideas" o "terminar".
</objective>

<context>
- Fecha de hoy: !`date +%Y-%m-%d`
- Hora: !`date +%H:%M`
- Carpeta destino: `.brainstorms/inbox/` (relativa al workspace actual)
- Brainstorm anterior más reciente en inbox: !`ls -1t .brainstorms/inbox/ 2>/dev/null | head -1 || echo "(ninguno previo en inbox)"`
- Idioma de toda la conversación y el archivo: **español mexicano**
</context>

<setup>
Antes de empezar, asegura que existan las carpetas de status:

```bash
mkdir -p .brainstorms/inbox .brainstorms/in-progress .brainstorms/completed .brainstorms/archived
```

Si la skill `b7s-review` aún no se ha corrido, esto es OK — `inbox/` es el destino default de cualquier brainstorm nuevo, y `b7s-review` después los mueve a `in-progress/`, `completed/`, o `archived/`.
</setup>

<process>

**Paso 1 — Cargar contexto previo (silenciosamente)**

Si en `<context>` aparece un "Brainstorm anterior más reciente" distinto de `(ninguno previo)`, léelo con la herramienta Read antes de hacer nada más:

`.brainstorms/inbox/{ARCHIVO_PREVIO}`

No le menciones al usuario que lo leíste a menos que sirva para hacer una conexión genuina con lo que comparta hoy.

**Paso 2 — Abrir la sesión**

Si `$ARGUMENTS` tiene contenido, ese es el primer pensamiento que el usuario quiere lluvear; trátalo como parte del dump y pasa al Paso 3 cuando termine de escribir.

Si `$ARGUMENTS` está vacío, responde algo breve y cálido, por ejemplo:

> "Listo, te escucho. Mándame todo lo que traes en la cabeza — sin filtros, sin orden, como salga. No te interrumpo. Cuando termines, organizo lo que entendí y entramos a profundizar."

**NO** hagas preguntas estructuradas todavía. **NO** uses AskUserQuestion en este paso. El usuario puede dumpear en uno o varios mensajes seguidos; espera a que termine.

**Paso 3 — Resumen organizado, fiel a su voz**

Cuando el usuario termine de dumpear:

1. Identifica los temas/proyectos/preocupaciones que aparecieron
2. Organízalos en secciones cortas con headers, bullets debajo
3. Mantén **sus palabras** y **su voz** — no traduzcas, no edites el tono, no agregues consejos ni juicios, no inventes detalles
4. Si algo quedó ambiguo, déjalo ambiguo (lo aclararemos en la profundización)
5. Muéstrale el resumen y dile algo como: "Esto fue lo que entendí. Lo guardo y entramos a profundizar."

**Paso 4 — Guardar el documento en `.brainstorms/inbox/`**

Ruta del archivo:
`.brainstorms/inbox/{FECHA_HOY}.md`

donde `{FECHA_HOY}` es la fecha del contexto en formato `YYYY-MM-DD`.

Si el archivo **no existe**, créalo con esta plantilla:

```markdown
---
date: {FECHA_HOY}
type: brainstorm
status: inbox
---

# 🧠 Brainstorm — {FECHA_HOY}

## 📝 Resumen organizado

{el resumen del Paso 3}

## 🔎 Profundización

_(se va llenando con las respuestas a las preguntas)_

## 🎯 Salidas accionables

_(se llena al cierre)_

## 📌 TODOs

_(checklist al cierre — formato `- [ ] tarea`. b7s-review lo lee de aquí.)_
```

Si el archivo **ya existe** (segundo brainstorm del día), no sobrescribas. Agrega al final:

```markdown

---

## 🧠 Brainstorm adicional — {HH:MM}

### Resumen organizado

{nuevo resumen}

### Profundización

_(se va llenando)_

### Salidas accionables

_(se llena al cierre)_

### TODOs

_(checklist al cierre)_
```

**Paso 5 — Profundizar con AskUserQuestion (en bucle)**

**Round 1 — Selección amplia (multi-select cubriendo TODO el dump):**

Agrupa **todos** los temas que aparecieron en el dump en categorías lógicas (ej: Tech/Setup, Comunicación, Proyectos, Pendientes). Lanza varias preguntas en paralelo (hasta 4) en una sola llamada a AskUserQuestion, cada una con `multiSelect: true` y hasta 4 opciones. El objetivo es que el usuario pueda **marcar todos los temas que le interesa profundizar** en una pasada — no forzarlo a un solo tema ni dejar fuera ninguno.

**No reduzcas la lista a "los más cargados"** — el usuario decide cuáles importan. Si hay más de ~16 temas, agrupa relacionados en un solo bullet, pero cubre todo lo que dumpeó.

**Round 2 — Priorización entre los seleccionados:**

Después del Round 1, lanza otro batch de preguntas (también `multiSelect: true` cuando aplique) para que el usuario marque cuáles van primero / esta semana / pueden esperar. Agrupa por urgencia o por tipo según lo que tenga sentido. En este round **incluye una pregunta meta** con: "Profundizar las que marqué" / "Agregar más ideas" / "Terminé por ahora".

**Round 3+ — Profundización tema por tema:**

Empieza por los temas con mayor prioridad y haz preguntas específicas a cada uno. Reglas por pregunta:

- Cada pregunta debe ser específica al contenido que el usuario compartió, no genérica.
- Da 2-4 opciones de respuesta concretas (no "sí/no" salvo que aplique).

**Opciones meta siempre disponibles (Round 2 en adelante):**

En cualquier round a partir del 2, **siempre** ofrece (como opciones dentro de una pregunta o como pregunta paralela):
- **"Quiero agregar más ideas / pensar en algo distinto"** (entra a otro mini-dump freestyle)
- **"Terminé por ahora"** (cierra la sesión)

Lo importante es que el usuario nunca se sienta atrapado entre opciones que no le acomodan.

Después de cada respuesta:

1. Lee el archivo del Paso 4 con Read
2. Edita la sección `## 🔎 Profundización` (o `### Profundización` si es brainstorm adicional) usando Edit, agregando lo nuevo en formato:
   ```
   ### {tema corto}
   - Pregunta: {tu pregunta}
   - Respuesta: {lo que dijo el usuario, en sus palabras}
   ```
3. Decide la siguiente pregunta a partir de lo que respondió, o:
   - Si eligió "agregar más ideas" → vuelve al Paso 2/3 con un mini-dump y luego sigue
   - Si eligió "terminé" → ve al Paso 6

Repite el ciclo hasta que el usuario cierre.

**Paso 6 — Cierre**

Cuando el usuario diga "terminé":

1. Relee el archivo completo
2. Edita la sección `## 🎯 Salidas accionables` poblándola con cualquier decisión clara, tarea concreta, o prioridad explícita que haya surgido — **en sus palabras**, no las tuyas. Si no surgió nada accionable, déjala vacía con una nota: `_(sin acciones específicas hoy — fue ventilación)_`
3. Edita la sección `## 📌 TODOs` con un checklist en formato GitHub:
   ```markdown
   - [ ] tarea concreta 1
   - [ ] tarea concreta 2
   ```
   Esta sección es la fuente de verdad que `b7s-review` lee para inventariar pendientes. Si no hubo TODOs, déjala con `_(sin TODOs hoy)_`.

4. **Pregunta sobre `/create-prompt` (vía AskUserQuestion):**

   > "¿Quieres que lance `/create-prompt` ahora con el contexto de este brainstorm para generar un prompt ejecutable en `prompts/7xx-brainstorm-executables/`?"

   Opciones a ofrecer:
   - **"Sí, genera el prompt ejecutable ahora"** — invoca la skill `create-prompt` con el archivo de brainstorm como input contextual; output destino: `prompts/7xx-brainstorm-executables/{NNN}-{slug}.md` donde `{NNN}` es el siguiente número en `prompts/index.json` bajo `7xx-brainstorm-executables.next` (incrementar después de crear) y `{slug}` describe el prompt en kebab-case
   - **"Sí, pero solo dame el outline del prompt, no lo guardes aún"** — produce solo un draft conversacional, sin escribir archivo
   - **"No, lo dejo para luego"** — saltar y cerrar normal

   Si el brainstorm no tiene contenido claramente ejecutable (fue puro venting), no preguntes — salta directo al paso 5.

5. Confirma al usuario:
   > "Guardado en `.brainstorms/inbox/{FECHA_HOY}.md`. Cuando quieras revisar pendientes y mover statuses, corre `/b7s-review`."

No muevas el archivo a otro status — eso lo hace `b7s-review`.
</process>

<success_criteria>
- El resumen del Paso 3 es fiel a la voz del usuario (sin interpretaciones, traducciones ni consejos agregados)
- El archivo existe en `.brainstorms/inbox/{FECHA_HOY}.md` con frontmatter correcto (`date`, `type: brainstorm`, `status: inbox`)
- Hubo al menos un round de AskUserQuestion antes de cerrar
- Cada round de preguntas (round 2+) ofreció las opciones "agregar más ideas" y "terminé por ahora"
- Las secciones "Salidas accionables" y "TODOs" se llenaron (o se marcaron como vacías explícitamente) al cierre
- Si el brainstorm tuvo contenido ejecutable, se le ofreció al usuario lanzar `/create-prompt` antes de cerrar
- Toda la conversación y todo el contenido del archivo en español mexicano
</success_criteria>

<output>
- `.brainstorms/inbox/{FECHA_HOY}.md` (creado o actualizado, status inbox)
</output>
</content>
</invoke>