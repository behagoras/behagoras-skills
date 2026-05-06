---
name: b7s-info-dump
description: Alias de `b7s-brainstorm` — info dump del día. Úsala cuando el usuario diga "info dump", "tengo que sacar todo lo que tengo en la cabeza", "info dump rápido".
argument-hint: (opcional) tema o pensamiento inicial
---

Alias de `b7s-brainstorm`. Lee y ejecuta tal cual las instrucciones de la skill `b7s-brainstorm`, tratando `$ARGUMENTS` como el primer pensamiento del dump (si hay).

No tiene comportamiento propio — todo el flujo (escuchar, organizar, guardar en `.brainstorms/inbox/`, profundizar) está definido en `b7s-brainstorm`.
