---
name: verify
description: Run full type-check and test suite to verify the project is in a good state. Use after making changes or before committing.
---

Run the following commands in sequence, stopping on the first failure:

1. `pnpm check` — Svelte type-checking (svelte-check)
2. `pnpm lint` — ESLint
3. `pnpm test:all` — Run both server-side and component tests

Report results clearly. If anything fails, show the relevant error output and suggest a fix.
