---
name: b7s-create-skill
description: Crea nuevas skills dentro del clon local de `behagoras-skills` siguiendo la metodología completa de `skill-creator` — entrevista al usuario, drafting, casos de prueba, eval-viewer e iteración, optimización de descripción, y empaquetado en el repo (skills.json, slash command, README, package.json `files` array). Valida la manifest contra el schema, corre `pnpm lint`, commitea atómicamente, y **abre un PR a `main` con el label de release apropiado** para que el workflow publique automáticamente a npm. Úsala cuando el usuario diga "crea una skill para behagoras", "agrega una skill al repo behagoras-skills", "nueva skill b7s", "scaffold a b7s skill", "package this skill into behagoras-skills", "abre un PR para una nueva skill b7s", o cuando termine de iterar una skill local y quiera publicarla por el flujo de behagoras-skills.
argument-hint: (opcional) nombre tentativo de la skill (kebab-case) o tema corto
---

<objective>
Crear una nueva skill **dentro del clon local de `behagoras-skills`** corriendo el flujo completo de `skill-creator` (entrevista → draft → casos de prueba → eval-viewer → iteración → optimización de descripción → empaquetado), y dejar todo listo para release: agrega entry a `skills.json`, crea el slash command, actualiza el array `files` de `package.json` y la tabla del README raíz, valida la manifest contra `skills.schema.json`, corre `pnpm lint`, hace un commit atómico, y **abre un PR a `main`** con el label de release apropiado (`release:patch` / `:minor` / `:major`) para que el workflow `release.yml` publique a npm cuando el PR se mergee.

No reimplementa `skill-creator`. **Lo orquesta** — delega la fase creativa (interview, drafting, evals, iteración) a `~/.claude/skills/skill-creator/` y agrega encima la finalización specific al monorepo de `behagoras-skills` (manifest + commit + PR).
</objective>

<context>
- Fecha de hoy: !`date +%Y-%m-%d`
- Clon default: `$HOME/git/projects/behagoras-skills`
- ¿Existe el clon en el default? !`test -d "$HOME/git/projects/behagoras-skills/.git" && echo "sí" || echo "no"`
- Branch del clon (si existe): !`git -C "$HOME/git/projects/behagoras-skills" branch --show-current 2>/dev/null || echo "(clon no encontrado)"`
- Skills ya en manifest: !`node -e "const m=require('$HOME/git/projects/behagoras-skills/skills.json');console.log(m.skills.map(s=>s.name).join(', '))" 2>/dev/null || echo "(no se pudo leer)"`
- ¿skill-creator instalado? !`test -d "$HOME/.claude/skills/skill-creator" && echo "sí" || echo "no"`
- Idioma de la conversación: **español mexicano** (el cuerpo del SKILL.md generado va en español por convención b7s-*; las descripciones públicas en `skills.json` y los `README.md` siempre en inglés)
</context>

<process>

**Paso 1 — Localizar el clon de behagoras-skills**

El default es `$HOME/git/projects/behagoras-skills`. Si existe (ver `<context>`), úsalo. Si no, lanza AskUserQuestion preguntando dónde está, con opciones:

- `$HOME/git/projects/behagoras-skills` (default — clonarlo si hace falta)
- `$HOME/git/behagoras-skills`
- Path custom...
- Cancelar la skill

Si el usuario elige clonar:

```bash
gh repo clone behagoras/behagoras-skills "$HOME/git/projects/behagoras-skills"
```

A partir de aquí, llama al path elegido `$BEHAGORAS_REPO`.

**Paso 2 — Verificar estado del repo y elegir branch**

Antes de tocar archivos:

```bash
git -C "$BEHAGORAS_REPO" status --porcelain
git -C "$BEHAGORAS_REPO" branch --show-current
```

Si hay cambios sin commit (la salida no está vacía), pregunta al usuario si quiere stashear o commitear lo existente antes de empezar. **Nunca toques archivos en proceso del usuario.**

Sobre el branch:

- Si el repo está en `main`: lanza AskUserQuestion proponiendo `feat/skill-<nombre-tentativo>` y deja que el usuario confirme o ajuste.
- Si ya está en una rama feature: pregunta si quiere stackear ahí o crear una nueva.

Crea/checkea la rama elegida antes de seguir.

**Paso 3 — Capturar intención (entrevista)**

Lanza AskUserQuestion con preguntas de scoping. Si `$ARGUMENTS` trae un nombre tentativo, úsalo como prefill de la primera pregunta.

Las preguntas mínimas a cubrir:

1. **Nombre de la skill** (kebab-case; el prefix `b7s-` es opcional pero recomendado para skills personales del usuario)
2. **Para qué sirve** (1-2 líneas — esto se vuelve el `description` del manifest, en inglés)
3. **Cuándo debe disparar** (frases del usuario / triggers en español o inglés según corresponda)
4. **Binarios externos** que necesita en runtime (yt-dlp, ffmpeg, python3, etc.) — para `requires.binaries` y `requires.optional`
5. **Config interactivo durante install** — la mayoría de skills NO lo necesita; solo `video-transcript` lo usa
6. **Idioma del cuerpo SKILL.md** — español mexicano (default para b7s-*) o inglés
7. **Slash commands** — un solo command (mismo nombre que la skill) o varios aliases

Si la skill es parte conceptual del trio b7s (brainstorm → review → prioritize), confirma con el usuario si debe documentarse en la sección "The b7s trio" del README raíz.

**Paso 4 — Delegar la fase creativa a `skill-creator`**

A partir de aquí, **delega el bulk del trabajo** al flujo completo de `skill-creator` (en `$HOME/.claude/skills/skill-creator/`). Eso significa correr **todas** las fases que documenta su `SKILL.md`:

1. **Drafting** del SKILL.md aplicando `Skill Writing Guide` y `Writing Style`. El archivo de salida vive en `$BEHAGORAS_REPO/<nombre>/SKILL.md`. El bundling (`scripts/`, `references/`, `assets/`) si la skill lo necesita también va dentro de esa carpeta.
2. **Test cases** realistas (2-3 prompts) guardados en `$BEHAGORAS_REPO/<nombre>/evals/evals.json`.
3. **Iteration loop**: spawn de subagentes con-skill y baseline en paralelo, grading via `agents/grader.md`, agregación con `python -m scripts.aggregate_benchmark`, eval-viewer (`eval-viewer/generate_review.py`), lectura de feedback, mejora del SKILL.md, y rerun en una nueva `iteration-N/`. El workspace vive en `$BEHAGORAS_REPO/<nombre>-workspace/` — ya está gitignoreado por el patrón `*-workspace/`.
4. **Description optimization** (opcional pero recomendada): `python -m scripts.run_loop` desde `$HOME/.claude/skills/skill-creator/` para optimizar el triggering de la descripción.

**No recortes esta fase**. Si el usuario explícitamente dice "vibe with me, salta los evals", está bien — pero por default ofrécelo y ejecútalo.

Si `skill-creator` NO está instalado (ver `<context>`):
- Avisa al usuario: "Sin `skill-creator` puedo hacer el draft inline, pero no hay eval-viewer ni description optimizer. ¿Continuo igual?"
- Si dice sí, corre la creación inline siguiendo las guías sin las herramientas externas.

**Paso 5 — Empaquetado en behagoras-skills**

Cuando la skill (SKILL.md + README.md) esté lista y aprobada por el usuario, agrega los archivos repo-specific.

**5.1 — Slash command** en `$BEHAGORAS_REPO/commands/<nombre>.md`:

```markdown
---
description: <one-liner inglés que describe qué hace>
argument-hint: <hint en inglés, opcional>
---

The user wants to <intent>. Read and follow the instructions in `$HOME/.claude/skills/<nombre>/SKILL.md` exactly.

<contexto extra sobre $ARGUMENTS si aplica>
```

Si la skill tiene aliases extra, crea un command file por alias — todos pueden apuntar al mismo SKILL.md.

**5.2 — README.md de la skill** en `$BEHAGORAS_REPO/<nombre>/README.md`:

Sigue el patrón corto de `b7s-review` y `b7s-prioritize`:

```markdown
# <nombre>

<one-liner inglés que matchea el `description` del manifest>. <Una frase opcional sobre lenguaje y contexto.>

> Looking for the model-facing contract? See [`SKILL.md`](./SKILL.md).

## Install

\`\`\`bash
npx behagoras-skills install <nombre>
\`\`\`
```

**5.3 — Entry en `skills.json`**:

Agrega un objeto al array `skills` siguiendo el orden alfabético existente. Estructura mínima:

```json
{
  "name": "<nombre>",
  "description": "<en inglés, derivado del Paso 3.2>",
  "path": "<nombre>",
  "commands": ["<comando-1>"],
  "requires": { "binaries": [] },
  "prompts": []
}
```

Si tiene binarios opcionales por plataforma, sigue el patrón de `video-transcript` (`requires.optional[]` con `platforms: ["darwin"]` / `["linux"]`).

**5.4 — `package.json` `files` array**:

Agrega `"<nombre>"` al array `files` para que npm incluya la carpeta al publicar. El array no está estrictamente ordenado, pero ponlo cerca de las otras skills (no al final con LICENSE/README).

**5.5 — Tabla del README raíz** (`$BEHAGORAS_REPO/README.md`):

- Sección `## Skills`: agrega una fila con el formato existente (link al README de la skill + one-liner + comando install).
- Sección `## Slash commands`: una fila por command con link al `commands/<nombre>.md` y descripción corta.
- Si el usuario dijo en el Paso 3 que esta skill es parte conceptual del trio, ajusta también el diagrama ASCII de la sección `### The b7s trio`.

**Paso 6 — Validar**

Corre estos checks en orden — si alguno falla, fija antes de avanzar:

```bash
# Validar manifest contra el schema
node -e "const Ajv=require('ajv').default;const a=new Ajv();const v=a.compile(require('$BEHAGORAS_REPO/skills.schema.json'));if(!v(require('$BEHAGORAS_REPO/skills.json'))){console.error(v.errors);process.exit(1)}else{console.log('skills.json OK')}"

# Type-check del CLI (asegura que ningún cambio rompe el build)
cd "$BEHAGORAS_REPO" && pnpm lint
```

Si `pnpm` no está instalado, skip `pnpm lint` con un warning — no abortes.

**Paso 7 — Smoke test de instalación (opcional pero recomendado)**

Antes de commitear, valida que la skill instala correctamente desde el repo local:

```bash
node "$BEHAGORAS_REPO/cli/dist/index.js" install <nombre> --repo-root "$BEHAGORAS_REPO" --force
node "$BEHAGORAS_REPO/cli/dist/index.js" list | grep "<nombre>"
test -L "$HOME/.claude/skills/<nombre>" && echo "symlink OK"
test -L "$HOME/.claude/commands/<nombre>.md" && echo "command OK"
```

Si el smoke falla, depura antes de commitear.

**Paso 8 — Commit atómico**

Stagea **explícitamente** los archivos nuevos/modificados (NUNCA `git add -A` ni `git add .`):

```bash
git -C "$BEHAGORAS_REPO" add \
  "<nombre>/SKILL.md" \
  "<nombre>/README.md" \
  "commands/<nombre>.md" \
  "skills.json" \
  "package.json" \
  "README.md"
```

Si la skill incluye assets adicionales (`<nombre>/scripts/`, `<nombre>/references/`, etc.) o aliases con commands extra, agrégalos también — uno por uno, sin comodines amplios.

Mensaje de commit (siguiendo el patrón existente del repo, ver `git log --oneline`):

```
feat(skill): add <nombre>

<resumen de 1-2 líneas de qué hace y por qué>
```

Crea el commit:

```bash
git -C "$BEHAGORAS_REPO" commit -m "feat(skill): add <nombre>" -m "<resumen>"
```

**Paso 9 — Push + abrir PR**

Pushea la rama al remote y abre el PR con `gh`:

```bash
git -C "$BEHAGORAS_REPO" push -u origin "$(git -C "$BEHAGORAS_REPO" branch --show-current)"
```

Antes de crear el PR, lanza AskUserQuestion preguntando qué label de release aplica:

- **`release:minor`** (Recomendado) — agregar una skill nueva es una feature backwards-compatible.
- **`release:patch`** — sólo si la skill es un fix/tweak interno que no agrega capacidad pública.
- **`release:major`** — sólo si la skill rompe contratos existentes (raro al agregar; más típico al renombrar/eliminar).
- **`skip-release`** — crear el PR sin disparar publish a npm (útil para iterar más antes de release).

Crea el PR con `gh pr create`. Título corto (≤70 chars), body con resumen + test plan. Usa HEREDOC para preservar el formato:

```bash
gh pr create \
  --repo behagoras/behagoras-skills \
  --base main \
  --title "feat(skill): add <nombre>" \
  --body "$(cat <<'EOF'
## Summary
- Nueva skill `<nombre>` — <one-liner inglés>
- <highlight extra si aplica, ej. "incluye scripts/ helper" o "se integra con b7s trio">

## Test plan
- [ ] `npx behagoras-skills install <nombre>` lands the symlink at `~/.claude/skills/<nombre>`
- [ ] `/<comando>` triggers the skill (slash command works)
- [ ] Eval cases pass (see `<nombre>-workspace/iteration-N/`)
- [ ] `pnpm lint` clean
- [ ] Manifest validates against `skills.schema.json`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)" \
  --label "<label-elegido>"
```

Si el usuario eligió `skip-release`, omite `--label` y avísale: "PR creado sin label — agrega `release:minor` (o el que aplique) cuando estés listo para publicar."

Si `gh` no está logueado o la creación del PR falla, reporta el error al usuario y dile cómo abrirlo manualmente:

> "No pude crear el PR automáticamente: <error>. La rama ya está pusheada — abre el PR en https://github.com/behagoras/behagoras-skills/pull/new/<branch>"

**Paso 10 — Cierre**

Reporta al usuario:

```
✅ Skill <nombre> creada en behagoras-skills

📂 Archivos creados/modificados:
  - <nombre>/SKILL.md
  - <nombre>/README.md
  - commands/<nombre>.md
  - skills.json (entry agregada)
  - package.json (files array)
  - README.md raíz (skills + slash commands tables)

✅ Schema validado
✅ pnpm lint OK
✅ Smoke test de install OK
✅ Commit creado: <SHA corto>
✅ Branch pusheada: <branch>
✅ PR abierto: <URL del PR> (label: <release-label>)

🚀 Cuando mergees el PR, el workflow `release.yml` se encarga del publish a npm automáticamente.
```

</process>

<edge_cases>
- **Clon no existe y el usuario no quiere clonarlo** → termina con un mensaje claro, sin tocar nada.
- **Working tree sucio** → pregunta antes de hacer cambios. Stash o commit existing first; nunca commits sobre cambios ajenos.
- **Nombre de skill ya existe en `skills.json`** → error early. Pregunta si quiere actualizar la skill existente (route a `skill-creator` con la skill como base) en lugar de crear una nueva.
- **Schema validation falla** → muestra el error de Ajv exacto, NO commits, pide al usuario que ayude a fijarlo.
- **`pnpm lint` falla por un cambio no relacionado** → reporta al usuario y pide decisión: arreglar primero o continuar igual.
- **Smoke test falla** → muy probable que `cli/dist/` esté outdated; sugiere correr `pnpm build` primero, no commits hasta resolverlo.
- **Skill grande con bundled scripts/assets** → confirma con el usuario si todos los archivos deben publicarse en npm (algunos pueden ser dev-only, ahí va `.npmignore` o exclusión por `files` array).
- **Pre-existing branch con scope distinto** (ej. `chore/remove-aliases` y la skill nueva no tiene relación) → propone una rama nueva off `main` para no mezclar concerns.
</edge_cases>

<success_criteria>
- Carpeta `<nombre>/` creada con SKILL.md y README.md válidos, redactados con la metodología de `skill-creator` (no draft mediocre)
- Hubo al menos una iteración con eval-viewer y user feedback (a menos que el usuario explícitamente lo haya saltado)
- Entry en `skills.json` agregada y validada contra `skills.schema.json` sin errores
- Slash command(s) creado(s) en `commands/`
- `package.json` `files` array incluye la nueva carpeta
- README raíz tiene la fila correspondiente en las tablas de skills y slash commands
- `pnpm lint` pasa
- Commit atómico con mensaje en formato `feat(skill): add <nombre>`
- Solo se stagearon los archivos relevantes (no `git add -A`, no `git add .`)
- Branch pusheada al remote con `-u origin`
- PR abierto a `main` con label de release elegido por el usuario (default sugerido: `release:minor`)
- URL del PR reportada al usuario
</success_criteria>

<output>
- Nueva skill scaffolded + iterada en `$BEHAGORAS_REPO/<nombre>/`
- Manifest, slash commands, README raíz y package.json actualizados
- Commit creado en una rama feature
- Branch pusheada y PR abierto a `main` con label de release
- Reporte al usuario con la URL del PR
</output>
