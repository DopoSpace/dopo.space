# Deployment Guide

## Overview

This guide covers deploying Dopo Space to a VPS (Hetzner) with PostgreSQL, Nginx, and PM2.

## Architecture

```
Internet
   ↓
Nginx (Reverse Proxy + SSL)
   ↓
PM2 (Process Manager)
   ↓
SvelteKit Application (Node.js)
   ↓
PostgreSQL Database
```

---

## Prerequisites

- Hetzner VPS (or similar) with Ubuntu 24.04 LTS
- Domain name configured (dopo.space)
- SSH access to server
- Basic Linux command line knowledge

---

## Initial Server Setup

### 1. Create Server

**Hetzner Cloud Console:**
- Location: Falkenstein, Germany (GDPR compliant)
- Type: CX21 (2 vCPU, 4GB RAM) - minimum recommended
- Image: Ubuntu 24.04 LTS
- Add SSH key

### 2. Connect to Server

```bash
ssh root@your-server-ip
```

### 3. Create Deploy User

```bash
# Create user
adduser deploy
usermod -aG sudo deploy

# Add SSH key for deploy user
mkdir -p /home/deploy/.ssh
cp /root/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys

# Switch to deploy user
su - deploy
```

### 4. Update System

```bash
sudo apt update && sudo apt upgrade -y
```

---

## Install Dependencies

### 1. Install Node.js 22 LTS

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node --version  # Should show v22.x
npm --version
```

### 2. Install PostgreSQL 16

```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

### 3. Configure PostgreSQL

```bash
# Switch to postgres user
sudo -u postgres psql

-- In PostgreSQL prompt:
CREATE DATABASE dopo_space;
CREATE USER dopo_user WITH ENCRYPTED PASSWORD 'your-secure-password';
GRANT ALL PRIVILEGES ON DATABASE dopo_space TO dopo_user;
\q
```

### 4. Install PM2

```bash
sudo npm install -g pm2
pm2 startup  # Follow the command it outputs
```

### 5. Install Nginx

```bash
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

---

## Application Deployment

### 1. Setup Application Directory

```bash
mkdir -p /home/deploy/dopo-space
cd /home/deploy/dopo-space
```

### 2. Clone Repository

```bash
git clone <repository-url> .
```

### 3. Install Dependencies

```bash
npm install --production
```

### 4. Configure Environment

```bash
cp .env.example .env
nano .env
```

Update with production values:
```env
DATABASE_URL="postgresql://dopo_user:your-password@localhost:5432/dopo_space?schema=public"
NODE_ENV="production"
APP_URL="https://dopo.space"
JWT_SECRET="<generate-secure-random-string>"

# PayPal Production
PAYPAL_CLIENT_ID="your-live-client-id"
PAYPAL_CLIENT_SECRET="your-live-secret"
PAYPAL_MODE="live"

# Mailchimp Production
MAILCHIMP_API_KEY="your-api-key"
MAILCHIMP_SERVER_PREFIX="us1"
MAILCHIMP_AUDIENCE_ID="your-audience-id"

# SMTP (use production email service)
SMTP_HOST="smtp.sendgrid.net"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="apikey"
SMTP_PASSWORD="your-sendgrid-api-key"
EMAIL_FROM="noreply@dopo.space"
```

### 5. Run Database Migrations

```bash
npx prisma migrate deploy
```

### 6. Build Application

```bash
npm run build
```

### 7. Setup PM2

Create `ecosystem.config.cjs`:
```javascript
module.exports = {
  apps: [{
    name: 'dopo-space',
    script: 'build/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};
```

Start application:
```bash
mkdir logs
pm2 start ecosystem.config.cjs
pm2 save
```

---

## Configure Nginx

### 1. Create Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/dopo-space
```

Add configuration:
```nginx
# Rate limiting
limit_req_zone $binary_remote_addr zone=general:10m rate=60r/m;
limit_req_zone $binary_remote_addr zone=auth:10m rate=10r/m;

server {
    listen 80;
    server_name dopo.space www.dopo.space;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name dopo.space www.dopo.space;

    # SSL certificates (will be added by Certbot)
    ssl_certificate /etc/letsencrypt/live/dopo.space/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/dopo.space/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Logging
    access_log /var/log/nginx/dopo-space-access.log;
    error_log /var/log/nginx/dopo-space-error.log;

    # Max upload size
    client_max_body_size 10M;

    # Rate limiting
    location / {
        limit_req zone=general burst=20 nodelay;

        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location /auth {
        limit_req zone=auth burst=5 nodelay;

        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 2. Enable Site

```bash
sudo ln -s /etc/nginx/sites-available/dopo-space /etc/nginx/sites-enabled/
sudo nginx -t  # Test configuration
sudo systemctl reload nginx
```

---

## SSL Certificate (Let's Encrypt)

### 1. Install Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 2. Obtain Certificate

```bash
sudo certbot --nginx -d dopo.space -d www.dopo.space
```

Follow prompts and choose redirect option.

### 3. Auto-renewal

Certbot installs a cron job automatically. Test renewal:
```bash
sudo certbot renew --dry-run
```

---

## Database Backups

### 1. Create Backup Script

```bash
sudo nano /usr/local/bin/backup-dopo-db.sh
```

Add script:
```bash
#!/bin/bash
BACKUP_DIR="/home/deploy/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/dopo_space_$TIMESTAMP.sql.gz"

mkdir -p $BACKUP_DIR

# Create backup
pg_dump -U dopo_user dopo_space | gzip > $BACKUP_FILE

# Delete backups older than 30 days
find $BACKUP_DIR -name "dopo_space_*.sql.gz" -mtime +30 -delete

echo "Backup completed: $BACKUP_FILE"
```

Make executable:
```bash
sudo chmod +x /usr/local/bin/backup-dopo-db.sh
```

### 2. Schedule Daily Backups

```bash
crontab -e
```

Add line:
```
0 2 * * * /usr/local/bin/backup-dopo-db.sh >> /home/deploy/logs/backup.log 2>&1
```

---

## Scheduled Jobs

### 1. Create Cron Script for Expired Memberships

```bash
nano /home/deploy/dopo-space/scripts/update-expired.js
```

Add script:
```javascript
import { PrismaClient, MembershipStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function updateExpiredMemberships() {
  const now = new Date();
  const result = await prisma.membership.updateMany({
    where: {
      status: MembershipStatus.ACTIVE,
      endDate: { lt: now }
    },
    data: {
      status: MembershipStatus.EXPIRED
    }
  });
  console.log(`Updated ${result.count} expired memberships`);
}

updateExpiredMemberships()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

### 2. Schedule Daily Job

```bash
crontab -e
```

Add line:
```
30 0 * * * cd /home/deploy/dopo-space && node scripts/update-expired.js >> logs/cron.log 2>&1
```

---

## Monitoring

### 1. PM2 Monitoring

```bash
# View logs
pm2 logs dopo-space

# Monitor processes
pm2 monit

# Process status
pm2 status
```

### 2. Nginx Logs

```bash
# Access logs
sudo tail -f /var/log/nginx/dopo-space-access.log

# Error logs
sudo tail -f /var/log/nginx/dopo-space-error.log
```

### 3. Database Monitoring

```bash
# Connect to database
psql -U dopo_user -d dopo_space

-- Check database size
SELECT pg_size_pretty(pg_database_size('dopo_space'));

-- Check active connections
SELECT count(*) FROM pg_stat_activity;
```

---

## Deployment Updates

### Automated Deployment Script

Create `deploy.sh`:
```bash
#!/bin/bash
set -e

echo "Starting deployment..."

cd /home/deploy/dopo-space

# Pull latest code
git pull origin main

# Install dependencies
npm install --production

# Run migrations
npx prisma migrate deploy

# Build application
npm run build

# Restart PM2
pm2 restart dopo-space

echo "Deployment completed!"
```

Make executable:
```bash
chmod +x deploy.sh
```

Run deployment:
```bash
./deploy.sh
```

---

## Security Checklist

- [ ] Firewall configured (ufw) - only ports 22, 80, 443 open
- [ ] SSH key-only authentication (password auth disabled)
- [ ] Database user with limited permissions
- [ ] Strong JWT_SECRET in production
- [ ] SSL certificate installed and auto-renewing
- [ ] Environment variables not committed to git
- [ ] Regular security updates (`apt update && apt upgrade`)
- [ ] Fail2ban installed for brute force protection
- [ ] Database backups tested and working
- [ ] Monitoring and alerting configured

---

## Staging Environment

For testing before production deployment:

1. Create second VPS or use subdomain (staging.dopo.space)
2. Follow same setup process
3. Use PayPal sandbox credentials
4. Use separate database
5. Deploy from `develop` branch instead of `main`

---

## Troubleshooting

### Application won't start

```bash
pm2 logs dopo-space --lines 100
```

Check for:
- Database connection errors
- Missing environment variables
- Port conflicts

### Database connection issues

```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Check connections
sudo -u postgres psql -c "SELECT * FROM pg_stat_activity;"
```

### Nginx errors

```bash
# Test configuration
sudo nginx -t

# Check logs
sudo tail -f /var/log/nginx/error.log
```

### SSL certificate issues

```bash
# Renew certificate manually
sudo certbot renew

# Check certificate status
sudo certbot certificates
```

---

## Performance Tuning

### PostgreSQL Optimization

Edit `/etc/postgresql/16/main/postgresql.conf`:
```
shared_buffers = 1GB
effective_cache_size = 3GB
maintenance_work_mem = 256MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 5MB
```

Restart PostgreSQL:
```bash
sudo systemctl restart postgresql
```

### Node.js/PM2 Optimization

Already configured for cluster mode in `ecosystem.config.cjs`.

---

## Resources

- [Hetzner Cloud Docs](https://docs.hetzner.com/cloud/)
- [Let's Encrypt](https://letsencrypt.org/)
- [PM2 Documentation](https://pm2.keymetrics.io/docs/)
- [Nginx Documentation](https://nginx.org/en/docs/)
