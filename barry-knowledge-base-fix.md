# Barry — Knowledge Base & Citation Fix

**Status:** Complete and verified locally (`brsa-demo`, both `/ask` and the in-app `/barry` page). **Not yet committed/pushed to the repo.** To go live: pull these changes into `main`, then run `npm run deploy` (build + `wrangler deploy`) from `brsa-demo/` to push to the `brsa-demo.klipklop.co.za` Worker.

---

## 1. Architecture recap

Barry runs in two layers:

**Client-side retrieval** (pure JS, runs in the browser, no server call needed for search itself)
- The "knowledge base" is `brsa-demo/public/data/brsa-rules.json` — 12 short entries, one per rulebook letter (A. Membership → L. Records).
- `brsa-demo/src/lib/brsaDomain.js` holds the system prompt, model name, and UI copy.
- A search engine turns the user's question into a ranked list of the most relevant rule entries ("citations"), and builds a text block from them ("context").

**Server-side answering**
- `brsa-demo/src/pages/Barry.jsx` POSTs `{ query, context, systemPrompt, model, history }` to `/api/rules/chat`.
- In production, `brsa-demo/worker.js` — a Cloudflare Worker — forwards that straight to Workers AI (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`) as a chat completion: system prompt + context + question → answer.

The key design intent: the LLM should **never** improvise BRSA rules — it should only restate what's in the `context` block, which is built entirely from the retrieved rule text. That's what "grounded" and "citable" mean here.

---

## 2. The bug — exact mechanism

The app was using a third-party package, `rules-engine` (`github:Geck018/rules-engine`), for the search step. Its tokenizer, in `node_modules/rules-engine/dist/chunk-7FXTO27U.js`:

```js
function tokenize(input) {
  return input.toLowerCase()
    .replace(/[^a-z0-9+/.-]+/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^[.+/-]+|[.+/-]+$/g, ""))
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));
}
```

Two things strip meaning out of a query:
1. `t.length > 2` — any token **2 characters or shorter is discarded**.
2. A ~90-word stopword list that includes `what`, `how`, `explain`, `tell`, `help`, `rule`, `rules`.

Walk through `"What's 2D?"`:
- Lowercased + non-alphanumeric stripped → `"what s 2d "`
- Split → `["what", "s", "2d"]`
- `"what"` → dropped (stopword). `"s"` → dropped (length 1). `"2d"` → **dropped, length is exactly 2, and the filter requires `> 2`.**
- Result: `[]` — zero tokens.

Downstream, `searchDomain()` starts with `if (queryTokens.length === 0) return []`, so it returns no matches at all. `buildDomainContext()` then returns `""` for an empty match list. So the actual network request Barry sent to the model had **no rule text in it whatsoever** — just the raw question.

This was verified two ways:
- Running the tokenizer function directly in the browser console: `tokenize("What's 2D?")` → `"[]"`.
- Confirming on the network tab that the citations array was empty and no citation UI rendered for that message.

Yet Barry still answered — because `BARRY_SYSTEM_PROMPT` has a "Key federation points you must not invent around" block baked directly into the instructions (e.g. *"Divisions 1D–5D are cut every 0.5 seconds off the fastest completed time"*). The model leaned on that summary text and did its own arithmetic on top of it. For "What's 2D?" it replied *"cut at 1 second off the fastest completed time"* — a number nowhere in the actual dataset, extrapolated as 2 × 0.5s. It even said "see Section E. Timing & divisions" despite having received zero retrieved excerpts — because that section name is *also* in the system prompt text, not because anything was actually looked up. This is the worst failure mode for a tool that promises "cite your source, never invent numbers": it *looked* grounded but wasn't.

This isn't a one-off — every division shorthand (1D/2D/3D/4D/5D) is exactly 2 characters, so **any question built mostly around those terms** ("Am I 3D?", "What's 4D pay?") skipped retrieval entirely.

---

## 3. The fix, piece by piece

### a) Replaced the search engine, not just tuned it

Rather than patch a vendored `node_modules` file (fragile — gets wiped on every `npm install`), a small, self-contained replacement was added: `brsa-demo/src/lib/barryRules.js`. It's the same basic TF-scoring approach (term frequency counted per doc, queries scored by token overlap), but:

```js
function tokenize(input) {
  return String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t))
}
```

`length >= 2` instead of `length > 2` — one character's difference, but it's the whole bug. `"2d"` now survives tokenization on both the query side and the indexing side (rule text gets tokenized the same way when the dataset loads).

It exports `loadBarryRules()` (fetch + index once, cached), `searchBarryRules(query, limit)` (ranked matches), and `buildBarryContext(matches, charBudget)` (turns matches into the text block sent to the model). `Barry.jsx` now imports these instead of `rules-engine/core`.

### b) Fixing the tokenizer alone wasn't enough — the source text didn't contain the terms

Even with `2D` tokenizable, indexing only works if `"2d"` actually appears somewhere in the rule text to match against. The original Section E text was:

> *"divisions 1D–5D are cut every 0.5 seconds off the fastest completed time..."*

That only literally contains the tokens `1d` and `5d` (from "1D–5D"). `2D`, `3D`, `4D` never appear as text anywhere in the dataset — so a fixed tokenizer alone would still return zero matches for "What's 2D?". `brsa-rules.json` was edited to spell out every division explicitly with its real numeric range:

> *"1D is 0–0.49 seconds off the pace, 2D is 0.50–0.99 seconds off, 3D is 1.00–1.49 seconds off, 4D is 1.50–1.99 seconds off, and 5D is 2.00 seconds or more off the pace."*

This does two jobs at once: makes every division term indexable, *and* gives the model an actual number to quote instead of inventing one.

### c) Told the model to quote, not summarize

The original complaint was that answers felt like loose summaries instead of the real rule wording. In `brsaDomain.js`, this was added to the system prompt:

> *"Quote or closely follow the actual wording of the excerpt you're using — don't loosely summarize away the specifics (exact seconds, percentages, deadlines). Always name the section you relied on."*

This only works well *because* retrieval is now reliable — telling the model to quote text it never received wouldn't have helped before.

### d) A second, related bug in the "is this personal?" check

`barryContext.js` has a `looksPersonal()` heuristic that decides whether to skip rulebook search entirely and answer from the signed-in demo rider's own data instead (points, fines, horses). It matched on substrings like `" i have "` and `" am i "`. Problem: *"What happens if I have an unpaid fine?"* is a general rules question, but it contains `" i have "`, so it got misclassified as personal — citations were suppressed (`citations: []`) even though the rulebook search would've found a perfect match in Section A. Those two overly broad phrases were removed, keeping the more specific ones (`" my "`, `" my fine"`, `" my wallet"`, etc.) that don't false-positive on generic phrasing.

### e) The citation UI — full rewrite

Originally, citations rendered via `line-clamp-2` (CSS truncation to 2 lines) — so even a real, correct match got cut off mid-sentence. This was replaced with a `<details>`/`<summary>` dropdown ("BRSA Rulebook") at the bottom of each answer. The first pass showed *all 12* rulebook sections with the relevant one highlighted; per feedback, this was narrowed to show **only** the section actually used — one matched section, full untruncated text, no highlighting needed since it's the only thing shown.

Each assistant message now stores `citation: citations[0] || null` — the single top-ranked match — instead of an array, and the `<Citation>` component just renders that one entry or nothing.

---

## 4. Verified behavior, before vs. after

| Query | Before | After |
|---|---|---|
| "What's 2D?" | Zero tokens → zero context → model guesses "1 second" with a phantom citation, no dropdown shown | Retrieves Section E → answers "2D is 0.50–0.99 seconds off the fastest completed time" → dropdown shows Section E's exact text |
| "What happens if I have an unpaid fine?" | Misclassified as personal → no dropdown even though it's a real rules question | Classified correctly → answers citing Section A. Membership → dropdown shows that section |
| "How are 1D to 5D divisions cut?" (already worked before) | Worked, but text was clamped to 2 lines in the citation preview | Same grounded answer, full untruncated rule text in the dropdown |

---

## 5. Files changed

- **New:** `brsa-demo/src/lib/barryRules.js`
- **Modified:** `brsa-demo/public/data/brsa-rules.json`, `brsa-demo/src/lib/brsaDomain.js`, `brsa-demo/src/lib/barryContext.js`, `brsa-demo/src/pages/Barry.jsx`

## 6. To deploy

1. Commit and push these files to `main`.
2. `cd brsa-demo && npm run deploy` (runs `vite build` then `wrangler deploy`).
3. Verify on `brsa-demo.klipklop.co.za/ask`: ask "What's 2D?" and confirm the dropdown shows Section E with the correct 0.50–0.99 second range.
