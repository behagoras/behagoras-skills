---
name: b7s-create-skill
description: Acceso directo al `skill-creator` — crea o mejora skills de Claude Code con guía experta. Úsala cuando el usuario diga "crea una skill", "create skill", "haz una skill", "necesito una skill que…", "edita esta skill", "quiero mejorar una skill".
argument-hint: (opcional) descripción de la skill a crear o mejorar
---

Esta skill es un **acceso directo** al `skill-creator` — no tiene lógica propia.

## Acción

Invoca inmediatamente la skill `skill-creator` (vía la herramienta Skill o el comando `/skill-creator`), pasándole `$ARGUMENTS` como contexto inicial de la skill que el usuario quiere crear o mejorar.

Si `$ARGUMENTS` está vacío, invoca `skill-creator` sin contexto adicional — el creador hará la entrevista al usuario para entender qué skill quiere.

## Por qué existe

Es un atajo nemónico: el usuario recuerda `/b7s-create-skill` más fácil que `/skill-creator` cuando quiere crear una skill rápido sin pensar el nombre exacto del comando.
