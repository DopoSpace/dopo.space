# Deployment Guide - Dopo Space

This guide covers deploying Dopo Space to Hetzner Cloud with Coolify.

## Overview

| Component | Technology |
|-----------|------------|
| Hosting | Hetzner Cloud CX22 (~€3.79/month) |
| Platform | Coolify (self-hosted PaaS) |
| Database | PostgreSQL 16 |
| Backup | Cloudflare R2 (free tier) |
| SSL | Let's Encrypt (via Coolify) |

## Prerequisites

- Domain: `dopo.space` (or your domain)
- SSH key pair
- GitHub repository access
- PayPal Developer account
- Mailchimp account
- Resend account

---

## Step 1: Create Hetzner Server

1. Sign up at [hetzner.com/cloud](https://www.hetzner.com/cloud)
2. Create a new project
3. Create server:
   - **Location**: Falkenstein (Germany) - closest to Italy
   - **Image**: Ubuntu 24.04 LTS
   - **Type**: CX22 (2 vCPU, 4GB RAM, 40GB NVMe)
   - **SSH Key**: Add your public key
   - **Name**: `dopo-space`

4. Note the server IP address

---

## Step 2: Install Coolify

SSH into the server and install Coolify:

```bash
ssh root@YOUR_SERVER_IP

# Install Coolify
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

Wait for installation to complete (2-3 minutes).

---

## Step 3: Initial Coolify Setup

1. Open `http://YOUR_SERVER_IP:8000` in browser
2. Create admin account
3. Complete initial setup wizard
4. Configure server settings

---

## Step 4: Configure DNS

In your domain registrar (e.g., Cloudflare, Namecheap):

```
dopo.space         A     YOUR_SERVER_IP
admin.dopo.space   A     YOUR_SERVER_IP
```

Wait for DNS propagation (5-30 minutes).

---

## Step 5: Deploy PostgreSQL

In Coolify:

1. Go to **Resources** → **New** → **Database** → **PostgreSQL 16**
2. Configure:
   - **Name**: `dopo-space-db`
   - **Database**: `dopo_space`
   - **User**: `dopo_user`
   - **Password**: Generate secure password
3. Deploy and wait for it to be running
4. Copy the `DATABASE_URL` from the connection details

---

## Step 6: Deploy Application

### Connect GitHub Repository

1. Go to **Sources** → **Add** → **GitHub**
2. Authorize Coolify to access your repository
3. Select `dopo.space` repository

### Create Application

1. Go to **Resources** → **New** → **Application**
2. Select GitHub source and repository
3. Configure:
   - **Name**: `dopo-space-app`
   - **Branch**: `main`
   - **Build Pack**: Dockerfile

### Configure Build Settings

In the application settings:

- **Dockerfile**: `Dockerfile` (root of repo)
- **Port**: `3000`

### Configure Environment Variables

Add all required environment variables:

```env
# Database
DATABASE_URL=postgresql://dopo_user:PASSWORD@dopo-space-db:5432/dopo_space?schema=public

# Application
NODE_ENV=production
APP_URL=https://dopo.space
MAIN_DOMAIN=dopo.space
ADMIN_SUBDOMAIN=admin

# Security (generate with: openssl rand -base64 32)
JWT_SECRET=your-32-plus-character-secret-key-here

# PayPal
PAYPAL_CLIENT_ID=your-live-client-id
PAYPAL_CLIENT_SECRET=your-live-client-secret
PAYPAL_MODE=live
PAYPAL_WEBHOOK_ID=your-webhook-id

# Mailchimp
MAILCHIMP_API_KEY=your-api-key
MAILCHIMP_SERVER_PREFIX=us1
MAILCHIMP_AUDIENCE_ID=your-audience-id

# Email (Resend)
RESEND_API_KEY=re_xxxxxxxxxx
EMAIL_FROM=Dopo Space <noreply@dopo.space>
```

### Configure Domains

1. Go to application **Settings** → **Domains**
2. Add domains:
   - `dopo.space` (primary)
   - `admin.dopo.space`
3. Enable **HTTPS** (Coolify will auto-generate Let's Encrypt certificates)

### Deploy

1. Click **Deploy**
2. Monitor build logs
3. Wait for deployment to complete

---

## Step 7: Run Database Migrations

SSH into the server and run migrations:

```bash
ssh root@YOUR_SERVER_IP

# Find the app container
docker ps | grep dopo-space-app

# Run migrations
docker exec -it <container_id> npx prisma migrate deploy
```

Or use Coolify's **Execute Command** feature in the application panel.

---

## Step 8: Create Admin User

```bash
# Via Docker
docker exec -it <container_id> npx tsx scripts/create-admin.ts admin@dopo.space YOUR_PASSWORD "Admin Name"
```

---

## Step 9: Configure PayPal Webhook

1. Go to [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/)
2. Navigate to **Webhooks**
3. Add webhook:
   - **URL**: `https://dopo.space/api/webhooks/paypal`
   - **Events**:
     - `CHECKOUT.ORDER.COMPLETED`
     - `CHECKOUT.ORDER.DECLINED`
     - `CHECKOUT.ORDER.VOIDED`
     - `PAYMENT.CAPTURE.COMPLETED`
     - `PAYMENT.CAPTURE.DENIED`
4. Copy the Webhook ID to your environment variables

---

## Step 10: Configure Backups

### Option A: Coolify Built-in Backups (Recommended)

1. In Coolify, go to **Settings** → **S3**
2. Configure Cloudflare R2:
   - **Endpoint**: `https://<account-id>.r2.cloudflarestorage.com`
   - **Region**: `auto`
   - **Access Key**: Your R2 access key
   - **Secret Key**: Your R2 secret key
   - **Bucket**: `dopo-space-backups`
3. Go to your PostgreSQL database → **Backups**
4. Configure:
   - **Frequency**: Every 6 hours
   - **Retention**: 7 days
5. Enable backups

### Option B: Manual Backup Script

1. Install rclone on server:
   ```bash
   curl https://rclone.org/install.sh | bash
   ```

2. Configure rclone for R2:
   ```bash
   rclone config
   # Create remote named 'r2' with R2 credentials
   ```

3. Copy and configure backup script:
   ```bash
   # Copy script to server
   scp scripts/deployment/backup.sh root@YOUR_SERVER_IP:/root/

   # Make executable
   chmod +x /root/backup.sh

   # Test backup
   /root/backup.sh

   # Setup cron (every 6 hours)
   (crontab -l 2>/dev/null; echo "0 */6 * * * /root/backup.sh >> /var/log/dopo-backup.log 2>&1") | crontab -
   ```

### Cloudflare R2 Setup

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) → **R2**
2. Create bucket: `dopo-space-backups`
3. Go to **Manage R2 API Tokens**
4. Create token with:
   - **Permissions**: Object Read & Write
   - **Bucket**: `dopo-space-backups`
5. Note the Access Key ID and Secret Access Key

---

## Verification Checklist

After deployment, verify:

- [ ] `https://dopo.space` loads homepage
- [ ] `https://admin.dopo.space` redirects to admin login
- [ ] Admin login works
- [ ] User registration works
- [ ] Magic link emails arrive
- [ ] PayPal payment flow completes
- [ ] PayPal webhook received (check logs)
- [ ] Newsletter subscription works (Mailchimp)
- [ ] Cron job active (check logs at 5:00 AM)
- [ ] Backup works (check R2 bucket after 6 hours)
- [ ] Test restore on local database

---

## Maintenance

### View Logs

```bash
# Application logs (via Coolify UI or Docker)
docker logs -f <container_id>

# Backup logs
tail -f /var/log/dopo-backup.log
```

### Manual Backup

```bash
/root/backup.sh
```

### Restore from Backup

```bash
/root/backup.sh --restore latest
```

### Update Application

Push to `main` branch - Coolify auto-deploys (if configured).

Or manually trigger deploy in Coolify UI.

### Run Migrations After Schema Changes

```bash
docker exec -it <container_id> npx prisma migrate deploy
```

---

## Cost Summary

| Service | Monthly Cost |
|---------|--------------|
| Hetzner CX22 | €3.79 |
| Cloudflare R2 (free tier) | €0.00 |
| Domain (yearly ÷ 12) | ~€1.00 |
| **Total** | **~€5/month** |

---

## Troubleshooting

### Application won't start

1. Check environment variables are set correctly
2. Verify DATABASE_URL is accessible
3. Check build logs in Coolify

### Database connection errors

1. Verify PostgreSQL container is running
2. Check network connectivity between app and db containers
3. Verify credentials in DATABASE_URL

### SSL certificate issues

1. Verify DNS is pointing to server
2. Wait for propagation (up to 48 hours)
3. Check Coolify logs for Let's Encrypt errors

### Webhook not receiving events

1. Verify webhook URL is HTTPS
2. Check PayPal webhook configuration
3. Review application logs for incoming requests

### Cron job not running

1. Check scheduler initialization in logs
2. Verify NODE_ENV=production
3. Container must be running continuously (not serverless)
