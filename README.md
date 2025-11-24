# Dopo Space - Membership Management System

A full-stack membership management system built with SvelteKit, PostgreSQL, and Prisma. This system handles member registration, payment processing via PayPal, newsletter management via Mailchimp, and admin tools for managing memberships.

## Features

- **User Authentication**: Passwordless magic link authentication
- **Membership Management**: Complete lifecycle from registration to expiration (States S0-S6)
- **Payment Processing**: PayPal integration for membership fees
- **Newsletter Integration**: Mailchimp integration for member communications
- **Admin Dashboard**: User management, membership number assignment, data export
- **Email Notifications**: Transactional emails for confirmations and updates
- **Mobile-Friendly**: Responsive design with Tailwind CSS

## Tech Stack

- **Frontend & Backend**: SvelteKit 2.x (full-stack framework)
- **Database**: PostgreSQL 16 with Prisma ORM 6.x
- **Styling**: Tailwind CSS 3.x
- **Authentication**: JWT + Magic Links
- **Payment**: PayPal Server SDK
- **Email**: Nodemailer (SMTP)
- **Newsletter**: Mailchimp API

## Getting Started

### Prerequisites

- Node.js 24.x (see `.node-version` for exact version)
  - Recommended: Use [fnm](https://github.com/Schniz/fnm) for version management
  - Alternative: nvm (`nvm install && nvm use`)
- PostgreSQL 16 or higher
- npm or pnpm

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd api.dopo.space
```

2. Install dependencies:
```bash
npm install
```

3. Copy environment variables:
```bash
cp .env.example .env
```

4. Configure your `.env` file with:
   - Database connection URL
   - PayPal credentials (sandbox for development)
   - Mailchimp API keys
   - SMTP settings
   - JWT secret

5. Create the database:
```bash
createdb dopo_space
```

6. Run database migrations:
```bash
npx prisma migrate dev
```

7. (Optional) Seed the database with initial data:
```bash
npx prisma db seed
```

### Development

Start the development server:

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### Database Management

Generate Prisma Client after schema changes:
```bash
npx prisma generate
```

Create a new migration:
```bash
npx prisma migrate dev --name description-of-changes
```

View database in Prisma Studio:
```bash
npx prisma studio
```

## Project Structure

```
src/
├── lib/
│   ├── server/              # Server-side code
│   │   ├── db/             # Database utilities (Prisma client)
│   │   ├── auth/           # Authentication logic
│   │   ├── email/          # Email service
│   │   ├── integrations/   # External services (PayPal, Mailchimp)
│   │   ├── services/       # Business logic
│   │   └── utils/          # Server utilities (validation, etc.)
│   ├── components/         # Svelte components
│   ├── types/             # TypeScript types
│   └── utils/             # Client-side utilities
├── routes/                 # SvelteKit routes (pages + API endpoints)
│   ├── auth/              # Authentication pages
│   ├── membership/        # Membership management
│   ├── admin/             # Admin dashboard
│   └── api/               # API endpoints
└── app.css                # Global styles

prisma/
├── schema.prisma          # Database schema
└── migrations/            # Database migrations
```

## Documentation

- [Architecture Overview](docs/ARCHITECTURE.md)
- [API Documentation](docs/API.md)
- [Database Schema](docs/DATABASE.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [Development Guide](docs/DEVELOPMENT.md)

## Building for Production

Create a production build:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

## License

Private - All rights reserved

## Support

For issues or questions, please contact the development team.
