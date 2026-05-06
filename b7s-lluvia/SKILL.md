---
name: b7s-lluvia
description: Alias de `b7s-brainstorm` — lluvia de ideas freestyle del día. Úsala cuando el usuario diga "lluvia", "lluvia de ideas", "vamos a lluviar", "tengo ideas para lluvia".
argument-hint: (opcional) tema o pensamiento inicial
---

Alias de `b7s-brainstorm`. Lee y ejecuta tal cual las instrucciones de la skill `b7s-brainstorm`, tratando `$ARGUMENTS` como el primer pensamiento del dump (si hay).

No tiene comportamiento propio — todo el flujo (escuchar, organizar, guardar en `.brainstorms/inbox/`, profundizar) está definido en `b7s-brainstorm`.
