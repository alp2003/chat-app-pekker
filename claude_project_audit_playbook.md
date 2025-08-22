# Claude Sonnet 4 – Safe Project Improvement Playbook

This document explains how to make **Claude Sonnet 4** safely go over your **NestJS + Next.js + Prisma/Postgres + Redis** monorepo and improve it with best practices **without breaking anything**.

---

## 0) Create a Safety Harness

### Branch + CI Gates
```bash
git checkout -b chore/ai-hardening
```

CI must fail the PR if any check fails:
- `pnpm -w typecheck`
- `pnpm -w lint`
- `pnpm -w test` (unit + e2e)
- `pnpm -w build`
- `prisma validate && prisma migrate status`
- `pnpm -w --filter=apps/web... exec next build`
- Canary suite: start services (DB/Redis), hit 3–5 golden paths

### AI Guardrails File (`AI_RULES.md`)
```md
# AI Change Guardrails
- No public API contract changes unless explicitly requested.
- No DB schema changes or Prisma migrations in this PR.
- Behavior must remain equivalent unless AC says otherwise.
- Feature-flag any risky behavior changes (default OFF).
- Output unified diffs only, minimal patches (no whole file rewrites).
- Add/adjust tests for each change.
- Prefer narrow Prisma `select`; avoid deep `include`.
- Use transactions with timeouts for multi-write flows.
- Redis: TTL+jitter caches, explicit invalidation on writes.
```

---

## 1) Generate Repo Map + CI Snapshot

### Repo Map
```bash
bash -lc 'echo "# Root"; ls -1; echo; echo "# Tree"; command -v tree >/dev/null && tree -L 2 || find . -maxdepth 2 -type d | sort' > repo-map.txt
```

### CI Snapshot
```bash
bash -lc '
  {
    echo "## typecheck"; pnpm -w typecheck || true
    echo; echo "## lint"; pnpm -w lint || true
    echo; echo "## build"; pnpm -w build || true
    echo; echo "## test"; pnpm -w test || true
    echo; echo "## next build"; pnpm -w --filter=apps/web... exec next build || true
    echo; echo "## prisma"; npx prisma validate && npx prisma migrate status || true
  } 2>&1
' > ci-snapshot.txt
```

---

## 2) Run **Read-Only Audit** First

**Audit Prompt**
```md
Role: Senior Staff Engineer (NestJS 10, Next.js App Router, Prisma/Postgres, Redis).

Mode: READ-ONLY AUDIT — no edits.

Deliverables:
1) Risks ranked P0–P2 (security, correctness, performance, reliability)
2) Quick wins (≤10 min each)
3) Structural refactors (guarded by tests)
4) Test gaps
5) Metrics/logging gaps
6) Concrete AC for safe PR (Pass A)

Guardrails:
[PASTE AI_RULES.md]

Context:
[PASTE repo-map.txt]
[PASTE ci-snapshot.txt]
```

---

## 3) Improve in **Small Passes**

### Pass A — Types/Lint/Dead code
```md
Goal: Fix type/lint issues and remove dead code.

Constraints:
- Output unified diffs only.
- No API/DTO or schema changes.
- Add/adjust tests for behavior parity.

Deliverables:
1) Plan
2) Patches (diffs)
3) Tests
4) Notes (why safe)
```

### Pass B — Observability
- Add **Pino logs** with requestId propagation
- Add **OpenTelemetry** spans (HTTP, Prisma)
- Expose `/health`, `/metrics` (protected)

### Pass C — Prisma Optimizations
- Narrow selects, remove unused includes
- Wrap multi-write flows in transactions
- Add keyset pagination utilities

### Pass D — Redis Cache + Rate Limit
- Read-through cache helper with TTL+jitter
- Invalidate on writes
- Add rate-limit guard for POSTs

### Pass E — Next.js Perf/UX
- Promote safe components to RSC
- Add `loading.tsx`, `error.tsx`
- Fix `next/image` sizes
- Dynamic import heavy widgets

---

## 4) Force Patch Format

Tell Claude to output **unified diffs** only, e.g.:

```diff
*** Begin Patch
*** Update File: apps/api/src/feature/example.ts
@@
- old line
+ new line
*** End Patch
```

Apply with:
```bash
git apply patch.diff
```

---

## 5) Self-Review Checklist

Claude should self-review every pass:

- AC met with no behavior change  
- Stricter types (no any/unknown leaks)  
- Prisma narrowed selects; tx with timeouts  
- Tests added/updated  
- Logs redact secrets, spans named  
- Risky changes feature-flagged  

---

## 6) Local Loop

For each pass:
```bash
git apply patch.diff
pnpm -w typecheck && pnpm -w lint && pnpm -w test && pnpm -w build
```

If failures: paste failing logs to Claude and request minimal fixes.

---

## 7) Isolate Risky Changes

- DB schema migrations → separate PR  
- API contract changes → separate PR  
- Risky behavior → feature-flagged  

---

## 8) Project Charter (paste every new thread)

```md
Project Charter:
- Stack: NestJS + Next.js + Prisma/Postgres + Redis, TS strict
- No schema/API changes in this PR
- Output unified diffs only
- DB: narrow select, keyset pagination, tx timeouts
- Redis: TTL+jitter caches, explicit invalidation
- Observability: Pino logs, OTel spans
- Tests: updated/deterministic only
```

---

## 9) Optional Canary Smoke Test

```ts
import request from 'supertest';
const base = process.env.API_URL ?? 'http://localhost:3000';

test('liveness', async () => {
  const r = await request(base).get('/health').expect(200);
  expect(r.body?.status ?? 'ok').toBe('ok');
});
```

Run with:
```bash
pnpm -w test -t canary
```

---

# Usage Flow
1. Commit `AI_RULES.md` + CI config  
2. Generate `repo-map.txt` + `ci-snapshot.txt`  
3. Run Audit Prompt → Claude reports issues  
4. Apply Pass A patches → verify CI  
5. Continue Pass B–E with self-review  
6. Merge once all passes green  
