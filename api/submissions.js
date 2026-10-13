// Server-only, read-only bridge for two explicitly allowed Pyramid HubSpot quote forms.
// Configure HUBSPOT_PRIVATE_APP_TOKEN and QUOTE_ADMIN_KEY in Vercel server environment.
import { timingSafeEqual } from 'node:crypto';

const FORMS = Object.freeze({
  '2026': '2c971242-d2df-4eaa-8acd-7a9b89eeddca',
  '2025': '49e1ff28-3101-42db-91a3-8230d0587788',
});

function sameSecret(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) return false;
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  return left.length === right.length && timingSafeEqual(left, right);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({error:'Method not allowed'}); }
  const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
  const key = process.env.QUOTE_ADMIN_KEY;
  if (!token || !key || key.length < 20) return res.status(503).json({error:'Integration not configured'});
  if (!sameSecret(req.headers['x-quote-admin-key'], key)) return res.status(401).json({error:'Unauthorized'});
  const form = String(req.query.form || "2026");
  if (!Object.hasOwn(FORMS,form)) return res.status(400).json({error:'Unsupported quote form'});
  const limit = Math.max(1, Math.min(50, Number(req.query.limit) || 30));
  const offset = Math.max(0, Math.min(1000, Number(req.query.offset) || 0));
  const guid = FORMS[form];
  const url = new URL(`https://api.hubapi.com/form-integrations/v1/submissions/forms/${guid}`);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));
  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) {
      console.error('HubSpot quote form read failed', response.status);
      return res.status(502).json({error:'HubSpot read failed', upstreamStatus:response.status});
    }
    const data = await response.json();
    const results = Array.isArray(data.results) ? data.results : [];
    const safe = results.map(x => ({
      submittedAt: x.submittedAt || x.timestamp || null,
      values: (Array.isArray(x.values) ? x.values : []).map(v => ({
        name: String(v.name || '').slice(0,120),
        value: typeof v.value === 'string' ? v.value.slice(0,3000) : v.value == null ? '' : String(v.value).slice(0,3000)
      }))
    }));
    return res.status(200).json({form, total: safe.length, hasMore: Boolean(data.hasMore), offset: Number(data.offset ?? offset), results:safe});
  } catch (e) {
    console.error('HubSpot quote form transport error', e?.name || 'unknown');
    return res.status(502).json({error:'HubSpot unavailable'});
  }
}
