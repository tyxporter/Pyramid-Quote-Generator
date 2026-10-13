# Pyramid Quote Generator — Recovery & HubSpot Intake (October 2026)

This repository is the **review branch** for Pyramid's existing Vercel quote generator. The previously deployed original is archived at \`recovery/original-2026-10-08.html\`. Nothing here should be promoted to production until automated PDF/Excel checks pass and original branded logo assets are safely restored or bundled.

## Source of truth

HubSpot remains the source of truth for deals, contacts, and submissions. The generator creates a draft service schedule (Attachment A), invoice schedule (Attachment B), and local exports. The new live import is intentionally **read-only**, with no auto-email or CRM writes.

## Verified quote form identifiers

- \`2026\` published intake form GUID: \`2c971242-d2df-4eaa-8acd-7a9b89eeddca\`
- \`2025\` published intake form GUID: \`49e1ff28-3101-42db-91a3-8230d0587788\`

The form selector maps only these two IDs. Do not broaden access until a form is verified.

## Configure Vercel integration securely

In Vercel > **porter made** > **pyramid-quote-builder** > Settings > Environment Variables, set these values for **Preview** first:

1. \`HUBSPOT_PRIVATE_APP_TOKEN\` — a least-privilege HubSpot private app token with permission to read forms and form submissions (confirm available scopes). Create and copy it *in HubSpot directly into Vercel*, never into GitHub/chat/client-side HTML.
2. \`QUOTE_ADMIN_KEY\` — a separate long random secret (minimum 20 characters) for authorized internal users. This is **not** your HubSpot password or token. Set it in Vercel only; share the access key through a secure password manager with Felicia, not in email or source control.

Redeploy a **preview** after adding variables. Open the preview URL while logged into Vercel. Click **Load from HubSpot** > **Refresh list**, enter the application access key, select a published form, select a submission, and click **Fill intake**. Always confirm state, rates, client email, scheduling phases and holiday premiums before exporting.

The browser sends its short-lived application access key to the project's same-origin \`/api/submissions\` endpoint. Vercel alone sends the HubSpot Bearer token to the allowlisted HubSpot endpoint. The API disallows writes, does not cache form data, and never returns the HubSpot token. **This is user-initiated retrieval**, not an automatic background sync or webhook.

## Tests

- \`npm install --no-package-lock\`
- \`npm run test\` — 10 deterministic quote-engine tests plus protected API tests
- \`npx playwright install chromium\`
- \`npm run test:exports\` — opens the app in Chromium and validates PDF text and spreadsheet formulas, including the $8,188 June 2027 Florida regression fixture.

GitHub Actions runs these tests for recovery branch pushes and pull requests. Require a passing check before merging \`main\`.

## Publication safety

- Production presently uses an October 8 standalone upload. Keep it unchanged until this review branch is tested and previewed.
- GitHub branch must be merged to \`main\` only after validation. In GitHub Settings > Branches/Rulesets, restrict direct pushes and require the Quote Builder Regression check if available under the account's plan.
- Preserve production alias and Vercel Authentication. Do not grant anonymous access because this app can process contact information.
- **Logo recovery:** original deployment contains \`logo.png\` and \`logo-sheet.png\`, but this branch temporarily references the production logo URL in its HTML. Bundle verified images before final cutover. The browser suite uses a fixture logo and does not certify branding pixels.
- The generator currently stores manually saved drafts in browser localStorage, not in HubSpot or shared storage.
- Review UI layout and exports using the approved 2026/2027 quote samples, including schedule dates, multi-pool shifts, invoice timing, holiday billing, and long season multi-page PDFs.

## Blockers before production

1. Configuring the Vercel environment variables and confirming HubSpot token access to the legacy submissions endpoint.
2. Validating a sample live 2026 and 2025 submission against current fields.
3. Passing PDF/Excel export tests in CI and a human visual review of both branded attachments.
4. Restoring logo binary assets and enforcing branch protection if supported.

No production promotion or HubSpot record mutation is authorized by the review branch.
