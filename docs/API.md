# API Documentation

## Authentication

All authenticated endpoints require a session cookie set after magic link login.

### Magic Link Flow

1. User enters email on `/auth/login`
2. System sends magic link email
3. User clicks link → redirected to `/auth/verify?token=<TOKEN>&email=<EMAIL>`
4. System verifies token → sets session cookie → redirects to dashboard

---

## Public Endpoints

### POST /auth/login

Request magic link email.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Magic link sent to your email"
}
```

**Errors:**
- `400`: Invalid email format
- `500`: Email sending failed

---

### GET /auth/verify

Verify magic link token and create session.

**Query Parameters:**
- `token` (required): JWT token from magic link
- `email` (required): User email

**Response:**
- Redirect to `/membership` on success
- Redirect to `/auth/login?error=invalid_token` on failure

**Side Effects:**
- Creates or updates user record
- Sets `session` cookie (HttpOnly, Secure, SameSite=Strict)

---

## User Endpoints (Authenticated)

### GET /membership

View membership status and dashboard.

**Response (Page Data):**
```typescript
{
  user: {
    id: string;
    email: string;
    newsletterSubscribed: boolean;
  };
  profile: {
    firstName: string;
    lastName: string;
    // ... other profile fields
  } | null;
  membershipSummary: {
    systemState: 'S0_NO_MEMBERSHIP' | 'S1_PROFILE_COMPLETE' | ... | 'S6_EXPIRED';
    hasActiveMembership: boolean;
    membershipNumber: string | null;
    startDate: Date | null;
    endDate: Date | null;
    profileComplete: boolean;
    canPurchase: boolean;
    message: string;
  }
}
```

---

### POST /membership/profile

Create or update user profile.

**Form Data:**
```typescript
{
  firstName: string;
  lastName: string;
  birthDate: string; // YYYY-MM-DD
  taxCode?: string;
  address: string;
  city: string;
  postalCode: string; // 5 digits
  province: string; // 2 letters
  documentType?: string;
  documentNumber?: string;
  privacyConsent: boolean; // must be true
  dataConsent: boolean; // must be true
}
```

**Response:**
```json
{
  "success": true,
  "profile": { /* profile data */ }
}
```

**Validation Errors:**
```json
{
  "success": false,
  "errors": {
    "firstName": "First name must be at least 2 characters",
    "postalCode": "Postal code must be 5 digits"
  }
}
```

---

### POST /membership/checkout

Initiate PayPal payment for membership.

**Request Body:**
```json
{
  "amount": 2500 // in cents
}
```

**Response:**
```json
{
  "success": true,
  "orderId": "PAYPAL-ORDER-ID",
  "approvalUrl": "https://paypal.com/checkoutnow?token=..."
}
```

**Errors:**
- `400`: User already has active membership
- `400`: Profile incomplete
- `500`: PayPal order creation failed

**Side Effects:**
- Creates `Membership` record with `PENDING` status
- Creates `payment_logs` entry

---

### POST /api/newsletter/subscribe

Subscribe to newsletter.

**Request Body:**
```json
{
  "subscribed": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully subscribed to newsletter"
}
```

**Side Effects:**
- Updates `user.newsletter_subscribed`
- Adds/updates contact in Mailchimp

---

### POST /api/newsletter/unsubscribe

Unsubscribe from newsletter.

**Request Body:**
```json
{
  "subscribed": false
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully unsubscribed from newsletter"
}
```

**Side Effects:**
- Updates `user.newsletter_subscribed`
- Unsubscribes contact in Mailchimp

---

## Admin Endpoints (Authenticated + Admin Role)

### GET /admin/users

List all users with filters.

**Query Parameters:**
- `status`: Filter by membership status (PENDING, ACTIVE, EXPIRED)
- `paymentStatus`: Filter by payment status
- `search`: Search by name or email
- `page`: Page number (default: 1)
- `limit`: Results per page (default: 50)

**Response:**
```json
{
  "users": [
    {
      "id": "user-id",
      "email": "user@example.com",
      "profile": { /* profile data */ },
      "membership": {
        "status": "ACTIVE",
        "membershipNumber": "2025-001",
        "startDate": "2025-09-01",
        "endDate": "2026-08-31",
        "paymentStatus": "SUCCEEDED"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 150,
    "totalPages": 3
  }
}
```

---

### GET /admin/users/:id

Get user details.

**Response:**
```json
{
  "user": { /* full user object */ },
  "profile": { /* profile data */ },
  "memberships": [ /* all memberships */ ],
  "paymentLogs": [ /* payment history */ ]
}
```

---

### PUT /admin/users/:id

Update user data (admin override).

**Request Body:**
```json
{
  "profile": {
    "firstName": "Updated Name",
    // ... other fields
  },
  "membership": {
    "startDate": "2025-09-01",
    "endDate": "2026-08-31",
    "membershipNumber": "2025-042"
  }
}
```

**Response:**
```json
{
  "success": true,
  "user": { /* updated user */ }
}
```

---

### DELETE /admin/users/:id

Delete user (GDPR compliance).

**Request Body:**
```json
{
  "confirm": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

**Side Effects:**
- Soft delete or anonymization based on configuration
- All related records (profile, memberships, logs) cascade deleted
- Mailchimp contact permanently deleted

---

### POST /admin/membership/assign-numbers

Assign membership numbers to users (batch or individual).

**Request Body (Sequential Assignment):**
```json
{
  "userIds": ["user-id-1", "user-id-2"],
  "startNumber": 42 // Optional: start from specific number
}
```

**Request Body (Specific Assignment):**
```json
{
  "specificNumbers": {
    "user-id-1": "2025-042",
    "user-id-2": "2025-043"
  }
}
```

**Response:**
```json
{
  "success": true,
  "assigned": [
    {
      "userId": "user-id-1",
      "membershipNumber": "2025-042"
    },
    {
      "userId": "user-id-2",
      "membershipNumber": "2025-043"
    }
  ]
}
```

**Side Effects:**
- Updates `membership.membership_number`
- Updates `membership.status` to `ACTIVE`
- Sends email notification to each user

---

### POST /admin/users/:id/force-payment

Force payment status (emergency only).

**Request Body:**
```json
{
  "paymentStatus": "SUCCEEDED",
  "reason": "Manual verification - bank transfer received"
}
```

**Response:**
```json
{
  "success": true,
  "membership": { /* updated membership */ }
}
```

**Side Effects:**
- Updates `membership.payment_status`
- Creates `payment_logs` entry with reason

---

### GET /admin/export

Export users data to CSV/Excel.

**Query Parameters:**
- `format`: `csv` or `xlsx` (default: csv)
- `status`: Filter by membership status
- `fields`: Comma-separated list of fields to include

**Response:**
- `Content-Type: text/csv` or `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- Downloadable file

**CSV Format:**
```csv
Email,First Name,Last Name,Membership Number,Status,Start Date,End Date
user@example.com,John,Doe,2025-001,ACTIVE,2025-09-01,2026-08-31
```

---

## Webhook Endpoints

### POST /api/webhooks/paypal

Handle PayPal webhook events.

**Headers:**
- `PAYPAL-TRANSMISSION-ID`
- `PAYPAL-TRANSMISSION-TIME`
- `PAYPAL-TRANSMISSION-SIG`
- `PAYPAL-CERT-URL`
- `PAYPAL-AUTH-ALGO`

**Request Body:**
```json
{
  "event_type": "CHECKOUT.ORDER.COMPLETED",
  "resource": {
    "id": "ORDER-ID",
    "status": "COMPLETED",
    // ... full PayPal order object
  }
}
```

**Response:**
```json
{
  "success": true
}
```

**Handled Events:**
- `CHECKOUT.ORDER.COMPLETED`: Update membership to SUCCEEDED
- `CHECKOUT.ORDER.DECLINED`: Update membership to FAILED
- `CHECKOUT.ORDER.VOIDED`: Update membership to CANCELED

**Side Effects:**
- Updates `membership.payment_status`
- Updates `membership.start_date` and `end_date` on success
- Creates `payment_logs` entry
- Sends payment confirmation email (S4 state)

**Security:**
- Verifies webhook signature using PayPal SDK
- Returns 401 if signature invalid

---

## Error Responses

All endpoints follow a consistent error format:

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": { /* optional additional info */ }
}
```

**Common HTTP Status Codes:**
- `200`: Success
- `400`: Bad request (validation error)
- `401`: Unauthorized (not logged in)
- `403`: Forbidden (insufficient permissions)
- `404`: Not found
- `500`: Internal server error

---

## Rate Limiting

- **Public endpoints**: 10 requests/minute per IP
- **Authenticated endpoints**: 60 requests/minute per user
- **Admin endpoints**: 120 requests/minute per admin

Rate limit headers included in responses:
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1633024800
```
