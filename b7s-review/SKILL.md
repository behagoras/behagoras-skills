---
name: b7s-review
description: Revisar TODOs pendientes de los brainstorms — lee `.brainstorms/inbox/` e `.brainstorms/in-progress/`, extrae el inventario de TODOs por archivo, te muestra status (pending/doing/done/snoozed/cancelled), y mueve archivos entre statuses. Úsala cuando el usuario diga "review brainstorms", "qué pendientes tengo", "revisar TODOs", "qué quedó pendiente del brainstorm de ayer", "actualizar status", "mover a completed", o cuando quiera cerrar el ciclo de un brainstorm.
argument-hint: (opcional) fecha o slug específico para revisar solo ese archivo
---

<objective>
Es el lado opuesto de `b7s-brainstorm`. Mientras `brainstorm` captura ideas en `.brainstorms/inbox/`, esta skill **revisa** los brainstorms guardados, **inventaria** los TODOs pendientes, y **mueve** archivos entre statuses (`inbox/` → `in-progress/` → `completed/`/`archived/`).

No genera ideas nuevas. Solo cierra el loop.
</objective>

<context>
- Fecha de hoy: !`date +%Y-%m-%d`
- Inbox: !`ls -1t .brainstorms/inbox/ 2>/dev/null | head -10 || echo "(vacío)"`
- En progreso: !`ls -1t .brainstorms/in-progress/ 2>/dev/null | head -10 || echo "(vacío)"`
- Completados (últimos 5): !`ls -1t .brainstorms/completed/ 2>/dev/null | head -5 || echo "(vacío)"`
- Idioma: **español mexicano**
</context>

<process>

**Paso 1 — Verificar setup**

Si `.brainstorms/` no existe, dile al usuario:
> "No hay `.brainstorms/` en este workspace todavía. Corre `/b7s-brainstorm` primero para crear tu primer brainstorm."
Y termina.

Si `.brainstorms/inbox/` y `.brainstorms/in-progress/` están ambos vacíos:
> "No hay brainstorms activos para revisar. {N} en `completed/`, {M} en `archived/`. ¿Quieres revisar algún histórico?"
Si dice no, termina.

**Paso 2 — Identificar archivos a revisar**

Si `$ARGUMENTS` tiene contenido:
- Si es una fecha (`YYYY-MM-DD` o `YYYY-MM-DD-slug`): busca el archivo en cualquier status folder. Si no existe, avisa.
- Si es texto libre: trátalo como hint para filtrar.

Si `$ARGUMENTS` está vacío: revisar **todos** los archivos en `inbox/` + `in-progress/` (los activos).

**Paso 3 — Extraer inventario de TODOs**

Para cada archivo a revisar, léelo con Read y extrae:

1. **Frontmatter**: fecha, type, status actual
2. **Sección `## 📌 TODOs`**: parsea cada `- [ ]` (pending) y `- [x]` (done). Si no existe la sección, busca también en `## 🎯 Salidas accionables` (formato libre).
3. **Salidas accionables (texto libre)**: si hay decisiones/acciones explícitas que no están como checkbox.

Construye un inventario consolidado:

```
📋 Inventario de TODOs

📅 2026-05-04 (in-progress)
  [ ] Llamar a Samy para confirmar agenda Ibero
  [x] Mandar PDF a Mike
  [ ] Decidir si cierro la oferta el viernes

📅 2026-05-05 (inbox)
  [ ] Comprar dominio para el side project
  [ ] Probar Whisper local con audios viejos

📅 2026-05-06 (inbox)
  (sin TODOs explícitos — fue ventilación)
```

Muéstraselo al usuario primero como overview.

**Paso 4 — Loop de actualización por archivo**

Para cada archivo con TODOs pendientes (en orden, empezando por el más viejo), corre AskUserQuestion con multi-select para que el usuario marque cambios de status por TODO:

**Pregunta por TODO** (puedes batchear hasta 4 TODOs en una sola llamada con preguntas paralelas):

> "Para `{tarea}` (de {YYYY-MM-DD}), ¿qué status?"
> Opciones:
> - `Done — la cerré`
> - `Doing — sigo en eso`
> - `Snoozed — para más tarde`
> - `Cancelled — ya no aplica`
> - `Sin cambio (sigue pending)`

Después de cada respuesta, edita el archivo:
- `Done` → cambia `- [ ]` por `- [x]` y agrega `(done {YYYY-MM-DD})` al final del item
- `Doing` → mantén `- [ ]` y agrega `(doing)` al final
- `Snoozed` → mantén `- [ ]` y agrega `(snoozed)` al final
- `Cancelled` → cambia `- [ ]` por `- [~]` y agrega `(cancelled)` al final
- Sin cambio → no toques el item

**Paso 5 — Decidir status del archivo completo**

Cuando termines de revisar todos los TODOs de un archivo, pregunta cuál es el status final:

> "Status del brainstorm de `{YYYY-MM-DD}`:"
> Opciones:
> - `In-progress — todavía hay pendientes vivos`
> - `Completed — todo cerrado o cancelado`
> - `Archived — ya no es relevante`
> - `Dejarlo en inbox por ahora`

Movimientos de archivo según respuesta:

```bash
# in-progress
mv .brainstorms/inbox/{archivo} .brainstorms/in-progress/{archivo}
# o si ya estaba ahí, no muevas

# completed
mv .brainstorms/{status-actual}/{archivo} .brainstorms/completed/{archivo}

# archived
mv .brainstorms/{status-actual}/{archivo} .brainstorms/archived/{archivo}
```

Actualiza el frontmatter `status:` del archivo (`inbox` / `in-progress` / `completed` / `archived`) con Edit antes de mover.

**Paso 6 — Resumen final**

Cuando termines todos los archivos, muestra:

```
✅ Review terminado

📊 Cambios aplicados:
- {N} TODOs marcados como done
- {M} TODOs en doing/snoozed
- {K} TODOs cancelled

📂 Archivos movidos:
- {archivo} → in-progress
- {archivo} → completed
- {archivo} → archived

⏳ Pendientes vivos: {N} en in-progress + {M} en inbox
```

Si quedan TODOs pendientes urgentes, sugiere:
> "¿Quieres que lance `/create-prompt` para alguno de los TODOs vivos para tenerlo como prompt ejecutable?"

</process>

<status_legend>
Marcadores en línea para TODOs:
- `- [ ] tarea` → pending (default)
- `- [x] tarea (done YYYY-MM-DD)` → completada
- `- [ ] tarea (doing)` → en progreso activo
- `- [ ] tarea (snoozed)` → pospuesta
- `- [~] tarea (cancelled)` → cancelada

Statuses de archivo (frontmatter `status:`):
- `inbox` → recién creado, sin revisar
- `in-progress` → revisado y todavía con pendientes vivos
- `completed` → todos los TODOs cerrados/cancelados
- `archived` → ya no es relevante (venting puro, ideas descartadas)
</status_legend>

<success_criteria>
- Inventario de TODOs mostrado antes de cualquier edición
- Cada cambio de status confirmado por el usuario vía AskUserQuestion (no asumir)
- Frontmatter `status:` del archivo y ubicación física (carpeta) siempre coinciden después de moverlo
- Archivos movidos via `mv` (no copy+delete) para preservar git history
- Toda la conversación en español mexicano
</success_criteria>

<output>
- Archivos en `.brainstorms/{inbox|in-progress|completed|archived}/` actualizados con TODOs marcados y status correcto
- Resumen de cambios al usuario
</output>
</content>
