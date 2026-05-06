---
name: b7s-ask
description: Convierte preguntas que Claude ya hizo en texto plano (en su última respuesta) a una llamada estructurada a `AskUserQuestion`, sintetizando 2-4 opciones por pregunta a partir del contexto de la conversación. Úsala cuando Claude te haya hecho preguntas en chat y prefieras responderlas con la UI de selección/multiselect en vez de redactar texto libre. Triggers: "/b7s-ask", "pregúntame con AskUserQuestion", "lánzalo como question", "convierte esa pregunta a UI", "ask me properly", "dame opciones para esa pregunta", "no me preguntes en texto, lánzame las opciones".
argument-hint: (opcional) hint sobre qué pregunta(s) convertir si Claude hizo varias en distintos temas
---

<objective>
Tomar las preguntas que Claude hizo en plain text en su(s) turno(s) reciente(s), sintetizar 2-4 opciones plausibles por pregunta a partir del contexto ya construido, y lanzarlas como una sola llamada a `AskUserQuestion` para que el usuario las responda con la UI de selección.

**Esta skill no inventa preguntas nuevas** — sólo re-formatea las que ya existen como texto. Si Claude pidió X, la skill pregunta X — no expande a Y, Z.
</objective>

<context>
- Idioma: **español mexicano** para preguntas y opciones, salvo que la conversación reciente haya estado claramente en inglés (entonces inglés).
- Hard cap del tool: máximo **4 preguntas** por llamada a `AskUserQuestion`.
- Hard cap del tool: **2-4 opciones** por pregunta (no menos de 2, no más de 4 — el usuario siempre tiene `Other` automático).
- Hard cap del header: **≤12 caracteres**.
</context>

<process>

**Paso 1 — Identificar las preguntas pendientes**

Relee la(s) última(s) respuesta(s) tuyas (asistente) en la conversación. Identifica preguntas que quedaron pendientes de responder. Busca:

- Frases que terminan en `?` (signo de interrogación)
- Listas numeradas o con bullets que enuncien opciones a elegir
- Frases del tipo "¿Quieres X o Y?", "¿Prefieres A?", "¿Empiezo por B?", "¿Sigo con C?"
- Construcciones implícitas: "Tengo dos caminos: ...", "Hay tres formas: ...", "Las opciones son: A, B, C"

Si `$ARGUMENTS` tiene contenido, úsalo como filtro/hint para enfocarte en preguntas relacionadas a ese tema (ej. `/b7s-ask deploy` → sólo las preguntas que tocan deployment).

Si no encuentras preguntas pendientes en tu(s) turno(s) reciente(s):

> "No detecté preguntas pendientes en mi última respuesta. ¿Hay algo específico sobre lo que quieras que te pregunte con opciones?"

Y termina (o pasa el control al usuario para que aclare).

**Paso 2 — Sintetizar opciones por pregunta**

Para cada pregunta detectada (máximo 4 — si hay más, ver Paso 3):

1. **Identifica el tipo de pregunta**:
   - Binaria (sí/no, A o B, hacer/no hacer): **2 opciones**
   - Selección entre vías ya enunciadas en mi respuesta: **1 opción por vía mencionada** (hasta 4)
   - Open-ended (sin caminos enunciados): sintetiza **2-3 caminos plausibles** desde el contexto de la conversación. La opción "Otro" no hace falta — `AskUserQuestion` la agrega automáticamente.

2. **Cada opción debe tener**:
   - `label`: 1-5 palabras, descriptivas. No abreviaturas crípticas.
   - `description`: 1 línea explicando qué pasa si la elige (trade-off, scope, consecuencia).

3. **Recomendación**: si en mi respuesta original sugerí explícitamente un camino ("yo iría con X", "te sugiero Y", "lo más limpio sería Z"), marca esa opción como `(Recomendado)` y ponla **primero** en el array. Si no recomendé nada, ordena por probabilidad/impacto/baja-fricción.

4. **Multi-select**: si la pregunta es naturalmente multi-respuesta ("¿qué features quieres?", "¿qué validaciones aplicas?"), pon `multiSelect: true`. Si es decisión única (A o B), `multiSelect: false`.

5. **Header**: 1-3 palabras (≤12 chars). Etiqueta corta tipo `lib choice`, `scope`, `approach`, `auth`, `format`.

**Paso 3 — Reglas de calidad y de scoping**

- **No inventes preguntas que no hice**. Si quieres preguntar algo que NO está en mi respuesta, díselo al usuario en chat — no lo metas dentro de `AskUserQuestion`.
- **Mantén el orden** de las preguntas según mi respuesta original (la primera pregunta del texto va primero en `AskUserQuestion`).
- **Si hay más de 4 preguntas**, prioriza las **más bloqueantes** (las que necesitan respuesta antes de poder avanzar). Lista las que dejaste fuera al final del turno con un comentario tipo:
  > "Quedan estas otras preguntas — si quieres responderlas también, lánzame `/b7s-ask` otra vez después: ..."
- **No agregues preguntas meta** ("¿quieres seguir?", "¿algo más?") — son ruido. El usuario ya puede cancelar la `AskUserQuestion` si quiere salir.
- **Si una pregunta no se puede convertir bien a opciones cerradas** (es genuinamente open-ended y no hay caminos plausibles desde el contexto), déjala en chat — no fuerces opciones malas. Reporta al usuario: "Esta pregunta es muy abierta para opciones, mejor respóndela libre: '<pregunta>'".

**Paso 4 — Lanzar AskUserQuestion**

Construye la llamada con todas las preguntas viables en una sola invocación. Después de que el usuario responda:

- **Continúa con la respuesta** que el usuario habría querido — no repitas la pregunta original ni hagas confirmación redundante.
- Las respuestas son input directo para tu siguiente acción.
- Si el usuario eligió `Other` en alguna y escribió texto custom, trátalo como respuesta válida y procede.

**Paso 5 — Edge case: ninguna pregunta detectable**

Si tu última respuesta no tenía preguntas (ej. fue un reporte de status sin pendientes), pregúntale al usuario en chat (sin `AskUserQuestion`):

> "No detecté preguntas en mi última respuesta. ¿Qué te gustaría que te preguntara?"

Espera input antes de hacer nada. Si responde con un tema, vuelve a Paso 1 con ese tema como `$ARGUMENTS`.

</process>

<examples>

**Ejemplo 1 — pregunta binaria con recomendación**

Mi respuesta anterior incluía: "¿Quieres que use TypeScript o JavaScript? Yo iría con TS para alinearnos con el resto del repo."

→ AskUserQuestion (1 pregunta):
- question: "¿TypeScript o JavaScript?"
- header: "language"
- multiSelect: false
- options:
  - { label: "TypeScript (Recomendado)", description: "Tipado estático, mejor IDE support, alineado con el resto del repo." }
  - { label: "JavaScript", description: "Más rápido de empezar, sin compile step." }

**Ejemplo 2 — múltiples preguntas paralelas en el mismo turno**

Mi respuesta anterior tenía 3 preguntas: "¿Library para fetch? ¿Validación con Zod? ¿Error boundary global?"

→ AskUserQuestion con 3 preguntas paralelas (mantén orden):
- "¿Library para fetch?" → fetch nativo / axios / ky / tanstack-query
- "¿Validación con Zod?" → sí en todo / sólo en boundaries / no, otra librería
- "¿Error boundary global?" → sí / no, lo manejo per-route

**Ejemplo 3 — pregunta multi-select con cap de 4 opciones**

Mi respuesta tenía: "¿Qué features quieres incluir? Login, signup, password reset, OAuth, MFA."

→ AskUserQuestion (1 pregunta):
- question: "¿Qué features de auth quieres incluir?"
- header: "auth feats"
- multiSelect: true
- options (agrupar para no exceder 4):
  - { label: "Auth básica", description: "Login + signup + password reset." }
  - { label: "OAuth (Google/GitHub)", description: "Login con providers externos." }
  - { label: "MFA", description: "Segundo factor (TOTP / SMS)." }
  - { label: "Sólo login", description: "Mínimo viable, sin signup ni reset todavía." }

**Ejemplo 4 — más de 4 preguntas**

Mi respuesta tenía 6 preguntas (lib, validación, error handling, auth, db, deployment).

→ Lanza las 4 más bloqueantes (lib + validación + auth + db) y al final del turno escribe en chat:
> "Lancé las 4 más bloqueantes. Quedan **error handling** y **deployment** — si quieres responderlas también, dame `/b7s-ask error handling deployment` después."

</examples>

<success_criteria>
- Las preguntas convertidas son las que realmente hice (no inventadas, no expandidas)
- Cada pregunta tiene 2-4 opciones con labels claros y descriptions específicas
- Si hubo recomendación explícita en mi respuesta, está marcada `(Recomendado)` y va primero
- Headers ≤12 caracteres y descriptivos (no genéricos como `option`)
- `multiSelect` correcto según naturaleza de la pregunta
- Si hubo >4 preguntas, las extras quedaron documentadas para un segundo `/b7s-ask`
- Tras la respuesta del usuario, la conversación continúa naturalmente sin redundar
</success_criteria>

<output>
- Una llamada a `AskUserQuestion` con 1-4 preguntas estructuradas
- (Si aplica) un mensaje al final listando preguntas que quedaron fuera por el cap de 4
- Después de las respuestas del usuario, continuación natural de la tarea original
</output>
