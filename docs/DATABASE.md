# Database Schema

## Overview

The database uses PostgreSQL 16 with Prisma ORM for type-safe queries and migrations.

## Tables

### admins

Stores admin accounts (separate from regular users).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | String (cuid) | PRIMARY KEY | Unique admin identifier |
| email | String | UNIQUE, NOT NULL | Admin email (used for login) |
| name | String | NULLABLE | Optional display name for audit trails |
| auth_token | String | NULLABLE | Token for magic link auth |
| created_at | DateTime | DEFAULT now() | Account creation timestamp |
| updated_at | DateTime | AUTO | Last update timestamp |

**Relations:**
- None (admins are independent from users)

**Indexes:**
- PRIMARY KEY on `id`
- UNIQUE on `email`

**Notes:**
- Admins are managed separately from users
- Admins cannot purchase memberships or access user routes
- Admins must be manually added to the database (no self-registration)
- Use the same magic link authentication as users
- See `docs/ADMIN_SETUP.md` for admin management guide

---

### users

Stores user accounts and authentication information.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | String (cuid) | PRIMARY KEY | Unique user identifier |
| email | String | UNIQUE, NOT NULL | User email (used for login) |
| phone | String | NULLABLE | Optional phone number |
| auth_token | String | NULLABLE | Token for magic link auth |
| newsletter_subscribed | Boolean | DEFAULT false | Newsletter opt-in status |
| mailchimp_subscriber_id | String | NULLABLE | Mailchimp subscriber ID |
| created_at | DateTime | DEFAULT now() | Account creation timestamp |
| updated_at | DateTime | AUTO | Last update timestamp |

**Relations:**
- One-to-one with `user_profiles`
- One-to-many with `memberships`

**Indexes:**
- PRIMARY KEY on `id`
- UNIQUE on `email`

---

### user_profiles

Stores user personal information and documents.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | String (cuid) | PRIMARY KEY | Profile ID |
| user_id | String | UNIQUE, NOT NULL, FK | Reference to users.id |
| first_name | String | NOT NULL | User first name |
| last_name | String | NOT NULL | User last name |
| birth_date | DateTime | NOT NULL | Date of birth |
| tax_code | String | NULLABLE | Italian tax code (Codice Fiscale) |
| address | String | NOT NULL | Street address |
| city | String | NOT NULL | City |
| postal_code | String | NOT NULL | Postal/ZIP code |
| province | String | NOT NULL | Province (2-letter code) |
| document_type | String | NULLABLE | Document type (ID, Passport, etc.) |
| document_number | String | NULLABLE | Document number |
| privacy_consent | Boolean | NOT NULL | Privacy policy acceptance |
| data_consent | Boolean | NOT NULL | Data processing consent |
| profile_complete | Boolean | DEFAULT false | Computed completeness flag |
| created_at | DateTime | DEFAULT now() | Creation timestamp |
| updated_at | DateTime | AUTO | Last update timestamp |

**Relations:**
- Many-to-one with `users` (CASCADE on delete)

**Validation Rules:**
- `tax_code`: Must match Italian tax code format if provided
- `postal_code`: Must be 5 digits
- `province`: Must be 2 uppercase letters
- `birth_date`: User must be at least 16 years old
- `privacy_consent` and `data_consent`: Must be TRUE for profile to be valid

---

### association_years

Defines membership periods and pricing.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | String (cuid) | PRIMARY KEY | Year ID |
| start_date | DateTime | NOT NULL | Period start date |
| end_date | DateTime | NOT NULL | Period end date |
| membership_fee | Integer | NOT NULL | Fee in cents (e.g., 2500 = €25.00) |
| is_active | Boolean | DEFAULT false | Only one active year at a time |
| created_at | DateTime | DEFAULT now() | Creation timestamp |
| updated_at | DateTime | AUTO | Last update timestamp |

**Relations:**
- One-to-many with `memberships`

**Indexes:**
- INDEX on `is_active`

**Business Rules:**
- Only one `is_active = true` record should exist at any time
- All memberships reference an association year
- Membership validity is determined by the year's `end_date`

**Example:**
```sql
INSERT INTO association_years VALUES (
  gen_random_uuid(),
  '2025-09-01',  -- start_date
  '2026-08-31',  -- end_date
  2500,          -- €25.00
  true,          -- is_active
  now(),
  now()
);
```

---

### memberships

Tracks individual membership records.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | String (cuid) | PRIMARY KEY | Membership ID |
| user_id | String | NOT NULL, FK | Reference to users.id |
| membership_number | String | UNIQUE, NULLABLE | Assigned card number (e.g., "2025-001") |
| association_year_id | String | NOT NULL, FK | Reference to association_years.id |
| start_date | DateTime | NULLABLE | Membership start date (set on payment) |
| end_date | DateTime | NULLABLE | Membership end date (copied from association year) |
| status | Enum | DEFAULT PENDING | PENDING, ACTIVE, EXPIRED |
| payment_status | Enum | DEFAULT PENDING | PENDING, SUCCEEDED, FAILED, CANCELED |
| payment_provider_id | String | NULLABLE | PayPal order ID |
| payment_amount | Integer | NULLABLE | Amount paid in cents |
| created_at | DateTime | DEFAULT now() | Creation timestamp |
| updated_at | DateTime | AUTO | Last update timestamp |
| updated_by | String | NULLABLE | Admin user ID who made changes |

**Relations:**
- Many-to-one with `users` (CASCADE on delete)
- Many-to-one with `association_years`
- One-to-many with `payment_logs`

**Indexes:**
- INDEX on `user_id`
- INDEX on `status`
- INDEX on `payment_status`
- UNIQUE on `membership_number`

**State Transitions:**
```
payment_status:
  PENDING → SUCCEEDED (on PayPal webhook success)
  PENDING → FAILED (on PayPal webhook failure)
  FAILED → PENDING (user can retry)

status:
  PENDING → ACTIVE (when membership_number is assigned)
  ACTIVE → EXPIRED (when end_date < now())
```

---

### payment_logs

Audit trail for payment events.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | String (cuid) | PRIMARY KEY | Log entry ID |
| membership_id | String | NOT NULL, FK | Reference to memberships.id |
| event_type | String | NOT NULL | Event name (e.g., "CHECKOUT.ORDER.COMPLETED") |
| provider_response | JSON | NOT NULL | Full webhook payload from PayPal |
| created_at | DateTime | DEFAULT now() | Event timestamp |

**Relations:**
- Many-to-one with `memberships` (CASCADE on delete)

**Indexes:**
- INDEX on `membership_id`

**Purpose:**
- Debugging payment issues
- Audit trail for financial records
- Replay events if needed

---

## Enums

### MembershipStatus
- `PENDING`: Membership created but not yet active
- `ACTIVE`: Membership active with assigned number
- `EXPIRED`: Membership past end_date

### PaymentStatus
- `PENDING`: Payment not yet completed
- `SUCCEEDED`: Payment successful
- `FAILED`: Payment failed
- `CANCELED`: Payment canceled by user

---

## Common Queries

### Get user with full membership info
```typescript
const user = await prisma.user.findUnique({
  where: { id: userId },
  include: {
    profile: true,
    memberships: {
      include: { associationYear: true },
      orderBy: { createdAt: 'desc' },
      take: 1
    }
  }
});
```

### Find users awaiting membership number (S4 state)
```typescript
const usersAwaitingNumber = await prisma.membership.findMany({
  where: {
    paymentStatus: 'SUCCEEDED',
    membershipNumber: null
  },
  include: {
    user: {
      include: { profile: true }
    }
  }
});
```

### Update expired memberships (daily cron job)
```typescript
const now = new Date();
await prisma.membership.updateMany({
  where: {
    status: 'ACTIVE',
    endDate: { lt: now }
  },
  data: {
    status: 'EXPIRED'
  }
});
```

---

## Migrations

Migrations are managed by Prisma. To create a new migration:

```bash
npx prisma migrate dev --name description_of_change
```

Migration files are stored in `prisma/migrations/` and should be committed to version control.

---

## Backup Strategy

1. **Daily full backups**: Automated PostgreSQL dump
2. **Incremental backups**: Every 6 hours via WAL archiving
3. **Retention**: 30 days of daily backups, 7 days of incremental
4. **Recovery**: Point-in-time recovery supported

See [DEPLOYMENT.md](./DEPLOYMENT.md) for backup implementation details.
