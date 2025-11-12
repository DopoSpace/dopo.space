# Development Guide

## Getting Started

### Prerequisites

- Node.js 22 LTS
- PostgreSQL 16
- Git
- A code editor (VS Code recommended)

### Initial Setup

1. **Clone and install:**
```bash
git clone <repository-url>
cd api.dopo.space
npm install
```

2. **Database setup:**
```bash
# Create database
createdb dopo_space

# Copy environment variables
cp .env.example .env

# Update .env with your local database URL
# DATABASE_URL="postgresql://postgres:postgres@localhost:5432/dopo_space?schema=public"

# Run migrations
npx prisma migrate dev
```

3. **Start development server:**
```bash
npm run dev
```

Application will be available at `http://localhost:5173`

---

## Development Workflow

### Running the Application

```bash
# Development with hot reload
npm run dev

# Development with custom port
npm run dev -- --port 3000

# Development with network access (test on mobile)
npm run dev -- --host
```

### Database Commands

```bash
# Generate Prisma Client after schema changes
npx prisma generate

# Create a new migration
npx prisma migrate dev --name add_user_roles

# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# View database in browser
npx prisma studio
```

### Code Quality

```bash
# Type checking
npm run check

# Type checking with watch mode
npm run check:watch

# Build production bundle (tests type errors)
npm run build
```

---

## Project Structure

```
src/
├── lib/
│   ├── server/              # Server-only code (never exposed to client)
│   │   ├── db/
│   │   │   └── prisma.ts   # Prisma client singleton
│   │   ├── auth/
│   │   │   └── magic-link.ts
│   │   ├── email/
│   │   │   └── mailer.ts
│   │   ├── integrations/
│   │   │   ├── paypal.ts
│   │   │   └── mailchimp.ts
│   │   ├── services/
│   │   │   ├── membership.ts
│   │   │   ├── user.ts
│   │   │   └── payment.ts
│   │   └── utils/
│   │       └── validation.ts
│   ├── components/         # Reusable Svelte components
│   │   ├── ui/            # Generic UI (Button, Card, etc.)
│   │   └── forms/         # Form components
│   ├── types/             # Shared TypeScript types
│   └── utils/             # Client-side utilities
├── routes/
│   ├── +page.svelte                    # Homepage
│   ├── +layout.svelte                  # Root layout (with CSS import)
│   ├── +layout.server.ts               # Root layout data loading
│   ├── auth/
│   │   ├── login/+page.svelte
│   │   ├── login/+page.server.ts       # Login form action
│   │   └── verify/+page.server.ts      # Magic link verification
│   ├── membership/
│   │   ├── +page.svelte                # Membership dashboard
│   │   ├── +page.server.ts             # Load membership data
│   │   ├── profile/+page.server.ts     # Profile form
│   │   └── checkout/+page.server.ts    # Payment checkout
│   ├── admin/
│   │   ├── +layout.server.ts           # Admin auth guard
│   │   ├── users/+page.server.ts       # User management
│   │   └── export/+page.server.ts      # Data export
│   └── api/
│       ├── webhooks/
│       │   └── paypal/+server.ts       # PayPal webhook handler
│       ├── newsletter/
│       │   ├── subscribe/+server.ts
│       │   └── unsubscribe/+server.ts
│       └── admin/
│           └── membership/
│               └── assign-numbers/+server.ts
├── hooks.server.ts         # Global middleware
├── app.css                 # Global styles
└── app.d.ts                # TypeScript declarations
```

---

## SvelteKit Concepts

### File Conventions

- `+page.svelte`: A page component
- `+page.server.ts`: Server-side load function and form actions
- `+layout.svelte`: Layout that wraps child pages
- `+server.ts`: API endpoint (GET, POST, etc.)
- `+error.svelte`: Error page

### Server vs Client Code

**Server-only (`$lib/server/`):**
- Database access
- API keys and secrets
- Authentication logic
- Email sending

**Shared (`$lib/`):**
- TypeScript types
- Validation schemas
- Utility functions

**Client-only:**
- Browser APIs
- Interactive components
- Form state management

### Loading Data

```typescript
// +page.server.ts
export async function load({ locals }) {
  const user = locals.user;
  const data = await prisma.membership.findFirst({
    where: { userId: user.id }
  });
  return { data };
}
```

### Form Actions

```typescript
// +page.server.ts
export const actions = {
  default: async ({ request, locals }) => {
    const formData = await request.formData();
    const email = formData.get('email');

    // Process form...

    return { success: true };
  }
};
```

---

## Testing Locally

### Email Testing

Use MailHog or similar SMTP testing tool:

```bash
# Run MailHog (requires Docker)
docker run -d -p 1025:1025 -p 8025:8025 mailhog/mailhog

# Update .env
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SECURE=false
```

Access MailHog UI at `http://localhost:8025` to see sent emails.

### PayPal Sandbox

1. Create PayPal sandbox account at https://developer.paypal.com
2. Create sandbox business and personal accounts
3. Get sandbox API credentials
4. Update `.env`:
```
PAYPAL_MODE=sandbox
PAYPAL_CLIENT_ID=<your-sandbox-client-id>
PAYPAL_CLIENT_SECRET=<your-sandbox-secret>
```

### Mailchimp Testing

Create a test audience in Mailchimp for development:

```
MAILCHIMP_AUDIENCE_ID=<test-audience-id>
```

---

## Common Development Tasks

### Adding a New Page

1. Create `src/routes/my-page/+page.svelte`:
```svelte
<h1>My New Page</h1>
```

2. (Optional) Add server-side data loading in `+page.server.ts`:
```typescript
export async function load() {
  return { message: 'Hello from server' };
}
```

3. Access at `http://localhost:5173/my-page`

### Adding an API Endpoint

Create `src/routes/api/my-endpoint/+server.ts`:
```typescript
import { json } from '@sveltejs/kit';

export async function GET() {
  return json({ message: 'Hello API' });
}

export async function POST({ request }) {
  const data = await request.json();
  // Process data...
  return json({ success: true });
}
```

### Adding a Database Model

1. Update `prisma/schema.prisma`:
```prisma
model MyModel {
  id String @id @default(cuid())
  name String
  createdAt DateTime @default(now())
}
```

2. Create migration:
```bash
npx prisma migrate dev --name add_my_model
```

3. Use in code:
```typescript
const item = await prisma.myModel.create({
  data: { name: 'Test' }
});
```

---

## Environment Variables

Required for development:

```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/dopo_space"

# App
JWT_SECRET="dev-secret-change-in-production"
APP_URL="http://localhost:5173"

# Optional for full functionality
PAYPAL_CLIENT_ID=""
PAYPAL_CLIENT_SECRET=""
MAILCHIMP_API_KEY=""
SMTP_HOST="localhost"
SMTP_PORT="1025"
```

---

## Debugging

### VS Code Launch Configuration

Create `.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug SvelteKit",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "port": 9229,
      "skipFiles": ["<node_internals>/**"]
    }
  ]
}
```

### Console Logging

**Server-side:**
```typescript
console.log('Server log:', data); // Shows in terminal
```

**Client-side:**
```typescript
console.log('Client log:', data); // Shows in browser console
```

### Database Queries

Enable Prisma query logging in `src/lib/server/db/prisma.ts`:
```typescript
log: ['query', 'error', 'warn']
```

---

## Performance Tips

1. **Use SSR for initial load**: Load data in `+page.server.ts`
2. **Lazy load components**: Use dynamic imports for heavy components
3. **Optimize images**: Use WebP format and responsive sizes
4. **Database indexes**: Add indexes for frequently queried fields
5. **Cache Prisma queries**: Use in-memory cache for reference data

---

## Code Style

- Use TypeScript for all new code
- Follow Prettier formatting (auto-format on save)
- Use Zod for validation schemas
- Document complex functions with JSDoc comments
- Use meaningful variable names
- Keep functions small and focused

---

## Common Issues

### "Module not found" errors

Run `npx svelte-kit sync` to regenerate SvelteKit files.

### Type errors after Prisma changes

Run `npx prisma generate` to update Prisma Client types.

### Database connection errors

Check PostgreSQL is running:
```bash
pg_ctl status
```

### Port already in use

Kill process on port 5173:
```bash
lsof -ti:5173 | xargs kill
```

---

## Resources

- [SvelteKit Documentation](https://kit.svelte.dev/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Zod Documentation](https://zod.dev)
