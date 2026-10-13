import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/submissions.js';
function response() {
  let statusCode=200;
  return {headers:{},setHeader(k,v){this.headers[k]=v;return this;},status(n){statusCode=n;this.statusCode=n;return this;},json(v){this.body=v;return this;},get statusValue(){return statusCode;}};
}
const req = (form='2026', key='a'.repeat(32))=>({method:'GET',query:{form},headers:{'x-quote-admin-key':key}});
test('HubSpot endpoint never serves without server secrets',async()=>{
  delete process.env.HUBSPOT_PRIVATE_APP_TOKEN;delete process.env.QUOTE_ADMIN_KEY;
  const res=response();await handler(req(),res);assert.equal(res.statusValue,503);assert.equal(res.headers['Cache-Control'],'private, no-store, max-age=0');
});
test('HubSpot endpoint rejects unauthorized users and unexpected forms',async()=>{
  process.env.HUBSPOT_PRIVATE_APP_TOKEN='dummy';process.env.QUOTE_ADMIN_KEY='a'.repeat(32);
  let res=response();await handler(req('2026','wrong'),res);assert.equal(res.statusValue,401);
  res=response();await handler(req('2024'),res);assert.equal(res.statusValue,400);
});
test('HubSpot endpoint restricts read to approved form GUID and sanitizes output',async()=>{
  process.env.HUBSPOT_PRIVATE_APP_TOKEN='dummy';process.env.QUOTE_ADMIN_KEY='a'.repeat(32);
  const realFetch=global.fetch;let called='';
  global.fetch=async (url,options)=>{called=String(url);assert.match(options.headers.Authorization,/Bearer dummy/);return {ok:true,json:async()=>({results:[{submittedAt:1790000000000,values:[{name:'email',value:'sample@example.com'}],secret:'must-not-leak'}],hasMore:false})};};
  try{
    const res=response();await handler(req('2026'),res);
    assert.equal(res.statusValue,200);
    assert.match(called,/2c971242-d2df-4eaa-8acd-7a9b89eeddca/);
    assert.equal(res.body.results[0].values[0].value,'sample@example.com');
    assert.equal(res.body.results[0].secret,undefined);
  }finally{global.fetch=realFetch;delete process.env.HUBSPOT_PRIVATE_APP_TOKEN;delete process.env.QUOTE_ADMIN_KEY;}
});
