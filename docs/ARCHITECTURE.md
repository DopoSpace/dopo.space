# Architecture Overview

## System Architecture

Dopo Space is built as a monolithic full-stack application using SvelteKit, which handles both frontend rendering and backend API logic.

```
┌─────────────────────────────────────────────────────┐
│                   Client Browser                     │
│  (SvelteKit SSR + Client-side hydration)            │
└──────────────────┬──────────────────────────────────┘
                   │
                   │ HTTP/HTTPS
                   │
┌──────────────────▼──────────────────────────────────┐
│              SvelteKit Application                   │
│  ┌─────────────────────────────────────────────┐   │
│  │  Frontend (Svelte Components)               │   │
│  │  - Pages, Forms, UI Components              │   │
│  └─────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────┐   │
│  │  Backend (Server Routes & API Endpoints)    │   │
│  │  - Authentication                            │   │
│  │  - Business Logic                            │   │
│  │  - Data Validation                           │   │
│  └─────────────────┬───────────────────────────┘   │
└────────────────────┼─────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
        ▼            ▼            ▼
┌─────────────┐ ┌─────────┐ ┌──────────────┐
│ PostgreSQL  │ │ PayPal  │ │  Mailchimp   │
│  Database   │ │   API   │ │     API      │
└─────────────┘ └─────────┘ └──────────────┘
                     │
                     ▼
              ┌──────────────┐
              │ SMTP Server  │
              │  (Nodemailer)│
              └──────────────┘
```

## System States (S0-S6)

The system implements a finite state machine for membership lifecycle:

```
S0: NO_MEMBERSHIP
  ↓ (user completes profile + payment)
S1: PROFILE_COMPLETE (awaiting payment)
  ↓ (payment initiated)
S2: PROCESSING_PAYMENT
  ├→ S3: PAYMENT_FAILED (can retry) → back to S1
  └→ S4: AWAITING_NUMBER (payment succeeded)
      ↓ (admin assigns number)
      S5: ACTIVE
        ↓ (end_date expires)
        S6: EXPIRED → can purchase new (back to S1)
```

## Data Flow

### User Registration & Authentication
1. User enters email on login page
2. System generates magic link token (JWT)
3. Email sent with magic link
4. User clicks link → token verified → session created
5. Session stored in cookie (HttpOnly, Secure)

### Membership Purchase Flow
1. User completes profile form (S0 → S1)
2. User initiates checkout
3. System creates `Membership` record with PENDING status
4. PayPal order created and user redirected
5. User completes payment on PayPal
6. PayPal webhook received (S2 → S4)
7. `Membership` updated with SUCCEEDED status
8. Email sent confirming payment
9. Admin assigns membership number (S4 → S5)
10. Email sent with membership number

### Admin Operations
1. Admin logs in (authenticated via same magic link system)
2. Views users list with filters
3. Selects users for number assignment
4. System generates sequential numbers or assigns specific ones
5. Emails automatically sent to users

## Key Design Decisions

### Why SvelteKit Monolith?

- **Simplified deployment**: Single application to deploy and manage
- **Type safety**: End-to-end TypeScript with Prisma types
- **Performance**: SSR + client-side hydration for fast initial loads
- **Developer experience**: Unified codebase, shared code between frontend/backend
- **Cost-effective**: Single VPS instance sufficient for expected load

### Database Design

- **Normalized schema**: Separate tables for users, profiles, memberships
- **Association years**: Enables different membership periods/fees per year
- **Audit trail**: `updated_at`, `updated_by` fields for tracking changes
- **Payment logs**: JSON storage for flexible webhook data

### Security Considerations

- **Magic links**: Reduces password-related vulnerabilities
- **JWT tokens**: Stateless authentication with expiration
- **HttpOnly cookies**: Session tokens not accessible via JavaScript
- **Input validation**: Zod schemas on both client and server
- **SQL injection**: Protected by Prisma ORM parameterized queries
- **GDPR compliance**: User data export, right to deletion

## Scalability Considerations

Current architecture supports:
- **~1000-5000 active members**: Single VPS with PostgreSQL
- **Payment bursts**: PayPal handles payment processing load
- **Email sending**: SMTP with rate limiting (consider SendGrid/SES for scale)

Future scaling paths if needed:
1. Add Redis for session storage and caching
2. Separate read replicas for PostgreSQL
3. CDN for static assets
4. Horizontal scaling with load balancer (multiple SvelteKit instances)

## Technology Stack Justification

| Technology | Purpose | Why Chosen |
|------------|---------|------------|
| SvelteKit | Full-stack framework | Best-in-class DX, performance, SSR support |
| PostgreSQL | Database | ACID compliance, JSON support, mature ecosystem |
| Prisma | ORM | Type-safe queries, migrations, excellent DX |
| Tailwind CSS | Styling | Rapid development, consistent design, small bundle |
| PayPal SDK | Payments | Required by client, standard integration |
| Mailchimp | Newsletter | Robust email marketing, compliance features |
| Nodemailer | Transactional email | Flexible SMTP support, cost-effective |

## File Organization

```
src/
├── lib/
│   ├── server/              # Server-only code (never sent to client)
│   │   ├── db/             # Database client
│   │   ├── auth/           # Authentication logic
│   │   ├── email/          # Email sending
│   │   ├── integrations/   # External APIs
│   │   ├── services/       # Business logic
│   │   └── utils/          # Validation, helpers
│   ├── components/         # Reusable UI components
│   ├── types/             # Shared TypeScript types
│   └── utils/             # Client-side utilities
├── routes/
│   ├── +page.svelte       # Homepage
│   ├── +layout.svelte     # Root layout
│   ├── auth/              # Authentication pages
│   ├── membership/        # User membership management
│   ├── admin/             # Admin dashboard
│   └── api/               # API endpoints (+server.ts files)
└── hooks.server.ts        # Global middleware (auth, etc.)
```

## API Design

SvelteKit uses a convention-based routing system:
- `+page.svelte`: UI page
- `+page.server.ts`: Server-side data loading and form actions
- `+server.ts`: REST-style API endpoints (GET, POST, etc.)

All API routes follow RESTful conventions where applicable.
