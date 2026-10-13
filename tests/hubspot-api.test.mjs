import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/submissions.js';

function response() {
  let statusCode = 200;
  return {
    headers: {},
    setHeader(k, v) { this.headers[k] = v; return this; },
    status(n) { statusCode = n; return this; },
    json(v) { this.body = v; return this; },
    get statusValue() { return statusCode; }
  };
}
const validHost = 'pyramid-quote-builder-bte5ds7mh-porter-made.vercel.app';
const request = (host=validHost, form='2026') => ({
  method: 'GET', query: {form}, headers: {host}
});

test('HubSpot is unavailable unless Preview contains server token', async () => {
  process.env.VERCEL_ENV = 'preview';
  delete process.env.HUBSPOT_PRIVATE_APP_TOKEN;
  const res = response();
  await handler(request(), res);
  assert.equal(res.statusValue, 503);
  assert.equal(res.headers['Cache-Control'], 'private, no-store, max-age=0');
});

test('HubSpot is never served on production even with configured token', async () => {
  process.env.VERCEL_ENV = 'production';
  process.env.HUBSPOT_PRIVATE_APP_TOKEN = 'dummy';
  const res = response();
  await handler(request(), res);
  assert.equal(res.statusValue, 403);
});

test('Custom or unrelated hosts are denied even on Preview', async () => {
  process.env.VERCEL_ENV = 'preview';
  process.env.HUBSPOT_PRIVATE_APP_TOKEN = 'dummy';
  for (const host of ['some-public-domain.example.com','pyramid-opportunity-agent-123-porter-made.vercel.app']) {
    const res=response();
    await handler(request(host), res);
    assert.equal(res.statusValue,403);
  }
});

test('HubSpot reads only the two allowlisted intake forms', async () => {
  process.env.VERCEL_ENV = 'preview';
  process.env.HUBSPOT_PRIVATE_APP_TOKEN = 'dummy';
  const res = response();
  await handler(request(validHost,'2024'), res);
  assert.equal(res.statusValue,400);
});

test('HubSpot read uses server Bearer token without exposing it to the browser', async () => {
  process.env.VERCEL_ENV = 'preview';
  process.env.HUBSPOT_PRIVATE_APP_TOKEN = 'dummy';
  const realFetch = global.fetch;
  let called = '';
  global.fetch = async (url,options)=>{
    called=String(url);
    assert.equal(options.headers.Authorization,'Bearer dummy');
    return {ok:true,json:async()=>({results:[{submittedAt:1790000000000,values:[{name:'email',value:'sample@example.com'}],secret:'must-not-leak'}],hasMore:false})};
  };
  try {
    const res = response();
    await handler(request(), res);
    assert.equal(res.statusValue,200);
    assert.match(called,/2c971242-d2df-4eaa-8acd-7a9b89eeddca/);
    assert.equal(res.body.results[0].values[0].value,'sample@example.com');
    assert.equal(res.body.results[0].secret,undefined);
    assert.doesNotMatch(JSON.stringify(res.body),/dummy/);
  } finally {
    global.fetch=realFetch;
    delete process.env.HUBSPOT_PRIVATE_APP_TOKEN;
    delete process.env.VERCEL_ENV;
  }
});
