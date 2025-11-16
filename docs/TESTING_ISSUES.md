# Test Suite Issues and Solutions

**Last Updated:** 2025-11-16
**Status:** 117/201 tests passing (58% overall, 95% server-side)

## Executive Summary

La test suite del progetto ha attualmente **84 test fallenti** suddivisi in due categorie con cause e soluzioni diverse:

1. **6 test in magic-link.test.ts** - Problemi di mocking Prisma (medio-complesso)
2. **78 test di componenti Svelte** - Incompatibilità Svelte 5 con SSR testing (complesso)

**IMPORTANTE:** Tutti i **90 nuovi test aggiunti nella sessione corrente funzionano al 100%** ✅

---

## 1. Magic Link Tests (6 failing)

### Problema
I test falliscono perché `verifyMagicLinkToken()` fa chiamate async al database Prisma ma i test non hanno mock configurati.

### Soluzione Raccomandata
Usare mock manuali con import dinamico:

1. Creare `src/lib/server/db/__mocks__/prisma.ts`
2. Aggiornare test con `await import()` 
3. Usare `vi.mocked()` per setup

**Effort:** 2-3 ore

---

## 2. Component Tests (78 failing)

### Problema
Svelte 5 ha cambiato architettura - `mount()` funziona solo client-side, non in Node.js/jsdom.

Errore:
```
Svelte error: lifecycle_function_unavailable
mount(...) is not available on the server
```

### Soluzioni Possibili

#### Opzione A: Vitest Browser Mode (Consigliata)
- Esegue test in vero browser (Playwright)
- **Effort:** 6-8 ore
- **Pro:** Coverage completa, supporto Svelte 5

#### Opzione B: Playwright Component Testing
- Migrazione completa a Playwright CT
- **Effort:** 12-16 ore  
- **Pro:** Soluzione moderna, debugging eccellente

#### Opzione C: Skip temporaneo
- Escludere test componenti da config
- **Effort:** 30 minuti
- **Pro:** Non blocca development

---

## Piano d'Azione Raccomandato

### Fase 1 (1-2 giorni)
1. Fix magic-link tests con mock manuali
2. Skip component tests temporaneamente
3. CI passa con 100% server tests (123/123)

### Fase 2 (1-2 settimane)
1. POC Vitest Browser Mode vs Playwright CT
2. Scegliere soluzione e creare migration plan
3. Migrare 78 tests in batch

---

## Riferimenti

- [Svelte 5 Testing](https://svelte.dev/docs/svelte/v5-migration-guide#Testing)
- [Vitest Browser Mode](https://vitest.dev/guide/browser.html)
- [Playwright Component Testing](https://playwright.dev/docs/test-components)
- [Prisma Unit Testing](https://www.prisma.io/docs/guides/testing/unit-testing)

**Documento completo:** Vedere questo file per analisi dettagliata, esempi codice, e troubleshooting.

## Phase 2 Implementation: Browser Mode Setup - COMPLETED

### Implementation Summary
Successfully configured Vitest Browser Mode for component testing:

1. ✅ Updated `vitest.config.ts` to exclude component tests temporarily
2. ✅ Installed required dependencies:
   - `@vitest/browser`
   - `@vitest/browser-playwright`
   - `playwright`
3. ✅ Created `vitest.browser.config.ts` with browser configuration
4. ✅ Updated package.json scripts:
   - `test:server` - Run server-side tests only
   - `test:components` - Run component tests in browser mode
   - `test:all` - Run both test suites

### Test Results (Initial POC)
- **Status**: Browser mode working correctly
- **Tests**: 31/78 passing (40% success rate)
- **Environment**: Chromium via Playwright
- **Duration**: ~4s for full suite

### Remaining Test Failures (47 tests)
Common issues to address:
1. **Multiple elements found**: Tests using `getByText` finding duplicate content
   - Example: Logo with "Dopo? Space" alt text appears multiple times
   - Solution: Use more specific queries (`getAllByText`, `getByRole`, or container-based queries)

2. **Query selector specificity**: Some tests need more precise element targeting

### Next Steps
1. Fix tests finding multiple elements (use `getAllByText` or more specific queries)
2. Update tests to use more robust selectors (roles, test IDs)
3. Aim for 100% passing component tests

### Configuration Files

**vitest.browser.config.ts**:
```typescript
import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		include: [
			'src/lib/components/**/*.test.ts',
			'src/routes/**/page.test.ts'
		],
		browser: {
			enabled: true,
			instances: [
				{
					browser: 'chromium',
					provider: playwright()
				}
			],
			headless: true
		},
		globals: true
	}
});
```

