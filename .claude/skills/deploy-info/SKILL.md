---
name: deploy-info
description: Show production server access and deployment information for Dopo Space.
disable-model-invocation: true
---

## Production Server

- **Host**: Hetzner Cloud CX22 (2 vCPU, 4GB RAM, 40GB NVMe)
- **SSH**: `ssh root@49.13.230.12`
- **Platform**: Coolify (self-hosted PaaS)
- **SSL**: Let's Encrypt (managed by Coolify)
- **Database**: PostgreSQL 16 (on same server)

## Deployment

Coolify auto-deploys when changes are pushed to `main`. No manual deployment steps needed.

For full deployment documentation, see @docs/DEPLOYMENT.md.

## Useful Commands (on server)

```bash
ssh root@49.13.230.12           # Connect to production
docker ps                        # Check running containers
docker logs <container> --tail 100  # View recent logs
```
