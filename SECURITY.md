# Security & API Keys

## ⚠️ IMPORTANT: Never Commit Secrets!

This project uses several API keys and tokens. **Never commit these to git!**

## Backend (Cloud Functions)

API keys for Cloud Functions are stored as **Firebase environment variables** using Firebase Functions secrets:

```bash
# Set a secret
firebase functions:secrets:set PUSHOVER_API_TOKEN

# View secrets
firebase functions:secrets:access PUSHOVER_API_TOKEN

# Use in functions/src/index.ts
const token = process.env.PUSHOVER_API_TOKEN;
```

### Current Backend Secrets:
- `PUSHOVER_API_TOKEN` - Pushover API application token
- `DEBUG_TOKEN_SECRET` - Secret for debug endpoints

## Frontend (Angular App)

Frontend API keys are **client-side visible** (users can see them in browser). These keys should have:
- Domain restrictions (only work from your domain)
- API usage limits
- No sensitive permissions

### Current Frontend API Keys:
- **OpenWeatherMap API** - Used in multiple services for weather data
- **Google Custom Search API** - Used for aircraft image search

### Security Notes:

1. **OpenWeatherMap & Google API keys are OK to be public** because:
   - They're restricted to specific domains (plane-alert.surge.sh)
   - They have usage quotas/limits
   - They're read-only APIs

2. **Pushover tokens should NEVER be frontend** - they're only in Cloud Functions ✅

## Testing Scripts

For local testing scripts like `test-pushover.js`, use a `.env` file:

```bash
# Copy the example
cp .env.example .env

# Edit .env and add your credentials
# The .env file is in .gitignore and won't be committed
```

## If You Accidentally Commit a Secret

1. **Immediately rotate/regenerate the API key**
2. **Remove the commit from history** (or accept that it's compromised)
3. **Update the new key in Firebase secrets**

```bash
# Rotate Pushover token
firebase functions:secrets:set PUSHOVER_API_TOKEN
# Enter new value when prompted
```

## GitGuardian Alerts

If you get GitGuardian alerts:
- Check which file triggered it
- Verify the secret is in `.gitignore` going forward
- Rotate the exposed credential immediately
- Update Firebase Functions secrets with new value
