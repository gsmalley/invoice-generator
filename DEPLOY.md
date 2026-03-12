# Deployment Guide

## Quick Deploy to Vercel

### Option 1: CLI (Fastest)
```bash
npm i -g vercel
cd /home/xoder/invoice-generator
vercel login
vercel --prod
```

### Option 2: Git Integration (Recommended for CI/CD)
1. Go to https://vercel.com/new
2. Import: https://github.com/gsmalley/invoice-generator
3. Configure:
   - Framework: Vite
   - Build: npm run build
   - Output: dist
4. Add env vars:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_PRICE_UNLIMITED` 
   - `STRIPE_PRICE_MULTI_BUSINESS`
5. Deploy!

---

## CI/CD Pipeline (GitHub Actions)

**Create file:** `.github/workflows/ci-cd.yml`

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [master]
  pull_request:
    branches: [master]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx tsc --noEmit
      - run: npm run build

  deploy:
    needs: build
    if: github.ref == 'refs/heads/master'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
```

**Add secrets in GitHub:**
- Go to Repo Settings → Secrets and variables → Actions
- Add: VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID

---

## Domain Setup

1. Buy domain (~$12/yr from Namecheap/Cloudflare)
2. Vercel → Project → Settings → Domains
3. Add domain and follow DNS instructions
4. SSL is automatic

---

## Status
- [x] Vercel config ready
- [x] Deployment guide ready
- [ ] Deploy to Vercel (needs you to run vercel --prod or import repo)
- [ ] Configure domain (needs domain purchase)