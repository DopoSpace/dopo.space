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
