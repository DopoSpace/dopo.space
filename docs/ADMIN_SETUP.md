# Admin Setup Guide

## Overview

Admins are managed in a separate `admins` table, completely independent from regular users. This keeps admin accounts simple and secure.

## Admin vs User

| Feature | User | Admin |
|---------|------|-------|
| Table | `users` | `admins` |
| Profile data | Yes (full profile with address, etc.) | No (just email + optional name) |
| Memberships | Yes | No |
| Newsletter | Yes | No |
| Can access `/membership` | Yes | No |
| Can access `/admin` | No | Yes |
| Authentication | Magic link | Magic link (same system) |

## How Authentication Works

1. **User or Admin enters email** on `/auth/login`
2. **Magic link sent** to email
3. **User clicks link** → system verifies token
4. **System checks**:
   - Is this email in `admins` table? → Sets `event.locals.admin` → redirect to `/admin`
   - Is this email in `users` table? → Sets `event.locals.user` → redirect to `/membership`
   - Not found? → Create new user (NOT admin) → redirect to `/membership`

**Important**: Admins must be manually added to the database. New signups are ALWAYS users, never admins.

## Adding an Admin

### Option 1: Database Migration (Production)

Create a migration to add initial admins:

```bash
npx prisma migrate dev --name add_initial_admins
```

Then manually edit the migration file to insert admin emails:

```sql
-- Add to migration file
INSERT INTO admins (id, email, name, created_at, updated_at) VALUES
  (gen_random_uuid(), 'admin@dopo.space', 'Admin Name', NOW(), NOW()),
  (gen_random_uuid(), 'another@dopo.space', 'Another Admin', NOW(), NOW());
```

### Option 2: Prisma Studio (Development)

```bash
npx prisma studio
```

1. Open the `Admin` model
2. Click "Add record"
3. Fill in:
   - email: admin email address
   - name: optional display name
4. Save

### Option 3: Direct SQL (Quick)

Connect to your database:

```bash
psql -U dopo_user -d dopo_space
```

Insert admin:

```sql
INSERT INTO admins (id, email, name, created_at, updated_at)
VALUES (gen_random_uuid(), 'admin@dopo.space', 'Admin Name', NOW(), NOW());
```

### Option 4: Seed Script (Development)

Create `prisma/seed.ts`:

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create admins
  await prisma.admin.createMany({
    data: [
      { email: 'admin@dopo.space', name: 'Main Admin' },
      { email: 'support@dopo.space', name: 'Support Admin' }
    ],
    skipDuplicates: true
  });

  console.log('Admins created');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

Add to `package.json`:

```json
{
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

Run:

```bash
npm install -D tsx
npx prisma db seed
```

## Removing an Admin

### Via Prisma Studio

```bash
npx prisma studio
```

Open `Admin` model and delete the record.

### Via SQL

```sql
DELETE FROM admins WHERE email = 'admin@dopo.space';
```

## Security Considerations

1. **No automatic admin creation**: Admins must be manually added
2. **Same authentication system**: Admins use the same secure magic link authentication as users
3. **Separate routes**: `/admin` routes are completely separate from `/membership` routes
4. **Middleware protection**: The `hooks.server.ts` middleware ensures only admins can access `/admin` routes
5. **Audit trail**: The `updated_by` field in `memberships` tracks which admin made changes

## Admin Capabilities

Once logged in, admins can access:

- `/admin/users` - View and manage all users
- `/admin/users/:id` - View/edit specific user
- `/admin/membership/assign-numbers` - Assign membership numbers
- `/admin/export` - Export user data to CSV/Excel
- `/admin/orders` - View payment history

Admins CANNOT:
- Access `/membership` routes (those are for regular users only)
- Purchase memberships (they're not members)
- Subscribe to newsletter as admin (separate from user accounts)

## Development vs Production

### Development
- Use any of the methods above to add test admins
- Can add/remove freely via Prisma Studio

### Production
- Add admins via migration or direct database access
- Keep a secure list of admin emails
- Use strong email providers for admin accounts
- Enable 2FA on admin email accounts
- Consider adding admin activity logging (future enhancement)

## Example: Full Admin Setup Flow

1. **Add admin to database**:
```bash
npx prisma studio
# Add admin@dopo.space
```

2. **Admin visits site**: Goes to `https://dopo.space/admin`

3. **Redirected to login**: System redirects to `/auth/login?error=admin_required`

4. **Enters email**: admin@dopo.space

5. **Receives magic link**: Clicks link in email

6. **Authenticated**: System finds email in `admins` table → sets `locals.admin` → redirects to `/admin`

7. **Admin dashboard**: Can now manage users, assign numbers, export data

## Troubleshooting

### "Admin required" error when trying to access /admin
- Check that your email is in the `admins` table
- Make sure you're logged in (check for session cookie)
- Try logging out and back in

### Admin can't see user data
- Check that the admin routes are loading `locals.admin` correctly
- Verify database connection

### Admin accidentally created as user
- Delete the user record
- Add email to admins table
- Have them log out and back in

## Code Reference

- Admin model: `prisma/schema.prisma:28-39`
- Admin utilities: `src/lib/server/auth/admin.ts`
- Middleware: `src/hooks.server.ts:52-62`
- Types: `src/app.d.ts:15-16`
