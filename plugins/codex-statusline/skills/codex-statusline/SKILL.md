---
name: codex-statusline
description: Aplica, audita o revierte el preset nativo de status line para Codex CLI.
---

# Codex Statusline

Usa esta skill cuando el usuario quiera configurar la barra inferior de Codex CLI con el preset de Behagoras, auditar si esta activo, imprimir el TOML recomendado o revertir un backup.

## Contexto

Codex CLI usa `tui.status_line` en `config.toml`: una lista ordenada de IDs integrados. No asumas que existe un `statusLine` command-backed como en Claude Code.

Codex pinta esa lista como una sola fila inferior. No prometas dos lineas de footer, saltos de linea, barras custom ni columnas arbitrarias hasta que Codex soporte multi-line status lines o un renderer externo. Si el usuario pide dos lineas, explica la limitacion y referencia `docs/codex-statusline/upstream-gap.md`.

El preset recomendado esta en `${PLUGIN_ROOT}/statusline-items.json` y se aplica con:

```bash
node "${PLUGIN_ROOT}/scripts/apply-codex-statusline.mjs"
```

Si `PLUGIN_ROOT` no esta disponible, usa el root del plugin instalado o del checkout local.

## Aplicar

1. Confirma el destino: `$CODEX_HOME/config.toml` si `CODEX_HOME` existe; si no, `~/.codex/config.toml`.
2. Ejecuta primero un dry-run:

```bash
node "${PLUGIN_ROOT}/scripts/apply-codex-statusline.mjs" --dry-run
```

3. Aplica el preset:

```bash
node "${PLUGIN_ROOT}/scripts/apply-codex-statusline.mjs"
```

4. Reporta el path del backup creado. Si el config no existia, reporta que se creo archivo nuevo y no habia archivo previo que respaldar.

## Auditar

Lee el config efectivo o el archivo indicado por el usuario y revisa:

- que exista `[tui]`
- que `status_line` contenga solo IDs soportados
- que los IDs del preset esten en el orden esperado
- que `status_line_use_colors = true`

Para imprimir el bloque esperado sin tocar archivos:

```bash
node "${PLUGIN_ROOT}/scripts/print-codex-statusline-config.mjs"
```

Tambien puedes pedir al usuario abrir Codex y usar `/statusline`; Codex puede omitir items sin datos disponibles, como PR, limites o task progress.

Los items `five-hour-limit` y `weekly-limit` son snapshots compactos controlados por Codex. Si el porcentaje parece ambiguo, pide comparar con `/status`, que es la vista autoritativa para desglose y resets.

## Revertir

Usa el backup timestamped creado por el aplicador:

```bash
node "${PLUGIN_ROOT}/scripts/apply-codex-statusline.mjs" --revert /path/to/config.toml.bak-YYYYMMDD-HHMMSS
```

Si el backup no sigue el patron `config.toml.bak-YYYYMMDD-HHMMSS`, pasa tambien `--config /path/to/config.toml`.

## No Hacer

- No configures `statusLine.type = "command"` para Codex CLI.
- No edites secciones ajenas a `[tui]`.
- No prometas costo, duracion o barras ANSI custom; Codex no expone esos items en la status line nativa actual.
- No prometas dos filas de contenido; Codex renderiza `tui.status_line` como una sola fila.
