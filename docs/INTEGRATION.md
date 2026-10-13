# Pyramid Quote Generator — HubSpot integration

## Authentication model

- Pyramid team members sign in to **Vercel Authentication** to access protected Quote Builder Preview deployments. The project currently enables Standard Protection for `*.vercel.app` deployment URLs.
- The Quote Builder browser retrieves submissions through `GET /api/submissions` on the same origin; it does not prompt for a shared admin key.
- The Vercel server alone uses `HUBSPOT_PRIVATE_APP_TOKEN` for HubSpot's submissions endpoint. This token is never included in the HTML or sent to browsers.
- The server refuses HubSpot submissions on Production and custom domains even if the token is present. Production availability requires a separate, reviewed authentication setup.
- The API supports **read-only** retrieval of verified 2025 and 2026 forms. It does not create deals, edit CRM records, send messages, or automatically ingest submissions without a user refresh.

## Correct Vercel project

**Team:** porter-made

**Project:** [pyramid-quote-builder](https://vercel.com/porter-made/pyramid-quote-builder)

**GitHub branch:** `recovery/quote-generator-oct-2026`

The HubSpot credential was mistakenly installed in the **different** project `pyramid-opportunity-agent`. It has to be added to this project's Preview environment instead. The Quote Builder project did not expose any environment variable names when inspected Oct 13, 2026.

In Vercel: Quote Builder → Settings → Environment Variables:

- Key: `HUBSPOT_PRIVATE_APP_TOKEN`
- Value: The HubSpot Service Key (or a supported read-only private app access token)
- Environment: **Preview**

Never paste the key into GitHub, this document, or ChatGPT. The Service Key must have the read scope accepted by the HubSpot form submissions endpoint. Once saved, create a **new Preview deployment** so the key is available at runtime.

After moving the credential, remove the Quote Builder-specific credentials from the Opportunity Agent project if they were not previously used there. Remove the old `QUOTE_ADMIN_KEY` as it is no longer used in this app.

## HubSpot form allowlist

- `2026` — `2c971242-d2df-4eaa-8acd-7a9b89eeddca`
- `2025` — `49e1ff28-3101-42db-91a3-8230d0587788`

HubSpot is the source of truth for the intake and client data. New quotes remain drafts until reviewed.

## Functional test after credential is placed

1. Log in to the protected Quote Builder Preview with a Vercel account that has permission to view the project.
2. Click **Load from HubSpot → Refresh list**. No shared admin key is needed.
3. Select the 2026 form and a known submission. Verify name, contact, city, state, ZIP, pool count, dates, schedule and $38/hr Florida rate ($28/hr elsewhere).
4. Repeat with an actual 2025 submission.
5. Generate Attachment A and Attachment B in PDF and XLSX, compare each to an approved client schedule, and verify invoice reconciliation.
6. Do not merge the branch until formatting, original brand logos and all production access controls are approved.

If `/api/submissions` returns 503, the project Preview token is missing. If HubSpot returns 401/403 upstream, verify scope or key type without publishing credentials. The legacy submissions API is due for migration to a date-based HubSpot API before its 2027 end-of-support window.

## Automated tests

```bash
npm install --no-audit --no-fund --no-package-lock
npm run test
npx playwright install chromium
npm run test:exports
```

CI validates server-side restrictions, rates, schedule overlap checks, PDF content and Excel formulas. Those tests cannot substitute for a live HubSpot request or for human visual sign-off.
