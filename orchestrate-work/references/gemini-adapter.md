# Gemini prompt adapter checklist

create-prompt specs are Claude-flavored by default: XML-structured, context-rich, constraint-heavy. Rewrite before every Gemini dispatch. Rules below are verbatim from `fable-tasks/09-model-strengths-and-prompting.md` ("→ Gemini 3.x") — that doc is the source of truth; if it changes, change this checklist.

Apply every item; mark N/A explicitly when an item doesn't apply (e.g., no multimodal inputs):

- [ ] **Direct and concise.** No fluff, no "please", no persuasion — it over-analyzes verbose prompt engineering meant for other models.
- [ ] **Instructions at the END**, after context/data. Anchor with "Based on the entire document above…".
- [ ] **Label every input explicitly** ("Image 1 (dashboard)", "File 2 (schema)") — ambiguous "look at this" fails.
- [ ] **No broad negative constraints** ("do not infer") — causes over-indexing and basic-logic failures; instead say positively what source to use.
- [ ] Default temperature (1.0); don't tune.
- [ ] It's terse by default; if you need verbose output, ask explicitly.
- [ ] For hallucination-prone topics: two-step (verify info exists → then answer).

## Rewrite pattern

```
[context / data / files, each explicitly labeled: "File 1 (auth middleware): ..."]

Based on the entire document above, <task in one or two direct sentences>.
<positive source anchor: "Use only File 1 and File 2 as sources.">
<output shape if verbose/structured output is needed>
```

Strip from the Claude-flavored original: XML scaffolding meant for Claude, "why" explanations behind constraints, politeness, broad "do not…" lists (convert each to a positive "use X / base it on Y").
