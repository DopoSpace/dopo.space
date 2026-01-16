# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Dopo Space is a full-stack membership management system built with SvelteKit 2.x, PostgreSQL 16, and Prisma 6.x. The system handles member registration, payment processing via PayPal, newsletter management via Mailchimp, passwordless authentication, and admin tools for managing memberships.

## Development Commands

### Setup and Installation
```bash
pnpm install                          # Install dependencies
cp .env.example .env                  # Copy environment template
npx prisma migrate dev                # Run database migrations
npx prisma db seed                    # Seed database with initial data
npx prisma generate                   # Generate Prisma Client after schema changes
```

### Node Version Management
The project uses Node.js v24.11.1. Version is specified in `.node-version`.

**fnm (recommended):**
```bash
fnm install && fnm use
```

**nvm:**
```bash
nvm install && nvm use
```

**Auto-switch (fnm):** Add to your `.zshrc` or `.bashrc`:
```bash
eval "$(fnm env --use-on-cd --version-file-strategy=recursive)"
```

### Development
```bash
pnpm dev                              # Start dev server (http://localhost:5173)
npx prisma studio                     # Open Prisma Studio for database inspection
```

### Testing
The project uses Vitest with two separate test configurations:

```bash
pnpm test                             # Run all server-side tests (unit tests, API tests)
pnpm test:server                      # Run server-side tests only (vitest.config.ts)
pnpm test:components                  # Run component tests only (vitest.browser.config.ts)
pnpm test:all                         # Run both server and component tests
pnpm test:watch                       # Run tests in watch mode
pnpm test:ui                          # Open Vitest UI
pnpm test:coverage                    # Generate coverage report
```

**Testing Architecture:**
- Server-side tests use jsdom environment (`vitest.config.ts`)
- Component tests use Vitest Browser Mode with Playwright (`vitest.browser.config.ts`)
- Component tests are in `src/lib/components/**/*.test.ts` and `src/routes/**/page.test.ts`
- Unit tests for services, utilities, and API logic are elsewhere in `src/**/*.{test,spec}.ts`

### Database Operations
```bash
npx prisma migrate dev --name description-of-changes  # Create new migration
npx prisma migrate deploy             # Deploy migrations (production)
npx prisma db push                    # Push schema changes without migration (dev only)
```

### Build and Production
```bash
pnpm build                            # Build for production
pnpm preview                          # Preview production build locally
pnpm check                            # Run svelte-check for type errors
pnpm check:watch                      # Type check with watch mode
```

### Admin Scripts
```bash
pnpm create-admin                     # Create admin user interactively
pnpm change-password                  # Change admin password
pnpm manage-year                      # Manage association years (create/activate)
pnpm seed-users                       # Seed test users (development only)
```

## Architecture

### Tech Stack
- **Frontend/Backend**: SvelteKit 2.x (Svelte 5.x) - full-stack framework
- **Database**: PostgreSQL 16 with Prisma ORM 6.x
- **Styling**: Tailwind CSS 3.x
- **Auth**: JWT + Magic Links (passwordless)
- **Payments**: PayPal Server SDK
- **Email**: Nodemailer (SMTP)
- **Newsletter**: Mailchimp API
- **Testing**: Vitest with Browser Mode for components

### Project Structure
```
src/
├── lib/
│   ├── server/                 # Server-only code (never sent to browser)
│   │   ├── db/                # Database client (Prisma)
│   │   ├── auth/              # Authentication (magic-link.ts, admin.ts)
│   │   ├── email/             # Email service (Nodemailer)
│   │   ├── integrations/      # External services (PayPal, Mailchimp)
│   │   ├── services/          # Business logic (membership.ts, etc.)
│   │   ├── utils/             # Server utilities (validation, etc.)
│   │   └── config/            # Environment validation (env.ts)
│   ├── components/            # Svelte components
│   ├── types/                 # Shared TypeScript types
│   └── utils/                 # Client-side utilities
├── routes/                    # SvelteKit routes (filesystem-based routing)
│   ├── auth/                  # Authentication pages
│   ├── membership/            # User membership dashboard
│   ├── admin/                 # Admin dashboard (protected)
│   └── api/                   # API endpoints (+server.ts files)
└── hooks.server.ts            # Global server middleware (auth, route protection)

prisma/
├── schema.prisma              # Database schema (source of truth)
└── migrations/                # Database migration history
```

### Membership State Machine (S0-S6)

The system uses a state machine defined in `src/lib/types/membership.ts`:

- **S0_NO_MEMBERSHIP**: User registered but no membership created
- **S1_PROFILE_COMPLETE**: Profile complete, ready for payment
- **S2_PROCESSING_PAYMENT**: Payment in progress
- **S3_PAYMENT_FAILED**: Payment failed or canceled
- **S4_AWAITING_NUMBER**: Payment succeeded, awaiting admin number assignment
- **S5_ACTIVE**: Number assigned, active membership
- **S6_EXPIRED**: Membership expired

State transitions are managed in `src/lib/server/services/membership.ts` via `getMembershipSummary()`.

### Authentication Architecture

Two separate authentication flows:

1. **User Auth**: Passwordless magic links (JWT-based)
   - Magic link sent via email
   - Token verification in `src/lib/server/auth/magic-link.ts`
   - User session stored in cookie

2. **Admin Auth**: Password-based (bcrypt)
   - Traditional username/password
   - Admin verification in `src/lib/server/auth/admin.ts`
   - Admin session stored in cookie

**Global Protection**: `src/hooks.server.ts` handles:
- Session validation on every request
- JWT verification and database lookups
- Session invalidation checks (logout from all devices)
- Route protection (`/admin/*` and `/membership/*`)
- Redirects unauthenticated users to login

### Database Schema Key Points

**Core Models:**
- `User` + `UserProfile`: User data and profile (one-to-one)
- `Admin`: Admin users with password auth
- `Membership`: User memberships (many-to-one with User)
- `AssociationYear`: Defines membership periods and fees
- `PaymentLog`: Audit trail for payment events
- `UsedToken`: Prevents token reuse for magic links

**Important Patterns:**
- Monetary values stored in cents (Int) to avoid floating point issues
- Cascade deletes configured (User -> Profile, Membership)
- Session invalidation timestamps for "logout from all devices"
- Profile fields nullable until user completes profile
- Consent fields tri-state: null (not asked), false (declined), true (accepted)

### Environment Configuration

Environment validation enforced at startup (`src/lib/server/config/env.ts`):
- Uses Zod for schema validation
- Fails fast if required vars missing/invalid
- JWT_SECRET must be 32+ characters and not default value
- SMTP config optional in development
- PayPal mode: 'sandbox' or 'live'

Required variables (see `.env.example`):
- Database: `DATABASE_URL`
- App: `APP_URL`, `JWT_SECRET`, `NODE_ENV`
- PayPal: `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_MODE`, `PAYPAL_WEBHOOK_ID`
- Mailchimp: `MAILCHIMP_API_KEY`, `MAILCHIMP_SERVER_PREFIX`, `MAILCHIMP_AUDIENCE_ID`
- SMTP: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM`, `SMTP_SECURE`

### SvelteKit Conventions

- **+page.svelte**: UI page component
- **+page.server.ts**: Server-side page logic (load, actions)
- **+server.ts**: API endpoint (GET, POST, etc.)
- **+layout.svelte**: Layout wrapper for routes
- **+layout.server.ts**: Server-side layout logic

Routes automatically protected by `hooks.server.ts` based on path prefix.

## Important Development Notes

### Testing Components vs Server Code
- Component tests MUST go in `vitest.browser.config.ts` (uses Playwright)
- Server-side tests (services, APIs, utils) go in `vitest.config.ts` (uses jsdom)
- Run both with `pnpm test:all` or separately with `pnpm test:server` / `pnpm test:components`

**Svelte 5 Note:** Svelte 5 changed its architecture - `mount()` only works client-side, not in Node.js/jsdom. Component tests MUST use Vitest Browser Mode (Playwright). Error if wrong config: `lifecycle_function_unavailable: mount(...) is not available on the server`

### Prisma Workflow
After schema changes:
1. `npx prisma migrate dev --name description` (creates migration)
2. `npx prisma generate` (updates Prisma Client types)
3. Restart dev server if types don't update

### PayPal Integration
- Uses PayPal Server SDK (v2)
- Webhook handler at `src/routes/api/webhooks/paypal/+server.ts`
- Payment events logged to `PaymentLog` table
- Membership state transitions triggered by webhook events

**Webhook Events Handled:**
- `CHECKOUT.ORDER.COMPLETED`: Membership → SUCCEEDED (S2 → S4)
- `CHECKOUT.ORDER.DECLINED`: Membership → FAILED (S2 → S3)
- `CHECKOUT.ORDER.VOIDED`: Membership → CANCELED

### Mailchimp Integration
- Newsletter subscription management
- `mailchimpSubscriberId` stored on User model
- Integration code in `src/lib/server/integrations/mailchimp.ts`

### Security Practices
- Never commit `.env` file
- Server-only code stays in `src/lib/server/`
- All database queries use Prisma (parameterized, SQL injection safe)
- JWT secrets validated at startup
- Session tokens verified on every protected route
- CSRF protection via SvelteKit's built-in mechanisms

### Code Style
- TypeScript strict mode enabled
- Zod for runtime validation
- Pino for structured logging
- Date-fns for date manipulation
- No client-side environment variables exposed (use `$env/static/private`)

### Profile Validation Rules (Italian-specific)
- `taxCode`: Must match Italian Codice Fiscale format (if provided)
- `postalCode`: Must be 5 digits
- `province`: Must be 2 uppercase letters
- `birthDate`: User must be at least 16 years old
- `privacyConsent` + `dataConsent`: Must be TRUE for profile to be valid

### Common Issues
- **"Module not found" errors**: Run `npx svelte-kit sync` to regenerate SvelteKit files
- **Type errors after Prisma changes**: Run `npx prisma generate` to update Prisma Client types
- **Port already in use**: `lsof -ti:5173 | xargs kill`
