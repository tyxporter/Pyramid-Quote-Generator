import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const scripts = [...html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g)].map(x => x[1]);
assert.equal(scripts.length, 4, 'Expected preserved calculator and user interface scripts');
const moduleShim = { exports: {} };
new Function('module', scripts[2])(moduleShim);
new Function(scripts[3]); // syntax-check DOM integration
const { buildModel, standardHolidays, layoutA, layoutB, parseHubspot } = moduleShim.exports;
const weekdays = Array.from({length:7}, (_,i)=>({on:i>=1&&i<=5,start:'10:00',end:'18:00',pools:1}));
const baseline = () => ({
  client:{name:'Test HOA',contact:'Test Manager',email:'test@example.com',phone:'5555555555',address:'123 Test St',city:'Orlando',state:'FL',zip:'32801',description:'Pool monitoring'},
  quote:{quoteDate:'2026-10-13',validUntil:'2026-11-13',firstDue:'Due upon signing agreement'},
  pricing:{rateAuto:true,rate:28,premium:14,admin:1500},
  phases:[{label:'June',note:'',start:'2027-06-01',end:'2027-06-30',days:weekdays}],
  overrides:[],addons:[],holidays:standardHolidays(2027)
});
test('Florida 2027 June invoices reconcile',()=>{
  const m=buildModel(baseline());
  assert.equal(m.ok,true,m.errors.join('; '));assert.equal(m.rate,38);assert.equal(m.totals.hours,176);
  assert.equal(m.totals.labor,6688);assert.equal(m.totals.seasonTotal,8188);assert.equal(m.invoiceSum,8188);
});
test('Georgia default rate',()=>{const s=baseline();s.client.state='GA';assert.equal(buildModel(s).rate,28);});
test('unknown state cannot inherit Georgia',()=>{const s=baseline();s.client.state='';assert.match(buildModel(s).errors.join(' '),/service state/);});
test('missing email and contact are blocked',()=>{const s=baseline();s.client.email='';s.client.contact='';assert.match(buildModel(s).errors.join(' '),/email/);assert.match(buildModel(s).errors.join(' '),/contact name/);});
test('overlapping times in phases block exports',()=>{const s=baseline();s.phases.push({...s.phases[0],label:'Overlap'});assert.match(buildModel(s).errors.join(' '),/Overlapping/);});
test('closed day reduces billable time',()=>{const s=baseline();s.overrides=[{date:'2027-06-01',action:'closed'}];const m=buildModel(s);assert.equal(m.ok,true);assert.equal(m.totals.hours,168);});
test('standard 2027 holidays match approved schedule',()=>{const h=standardHolidays(2027);assert.equal(h.find(x=>x.name==='Memorial Day').date,'2027-05-31');assert.equal(h.find(x=>x.name==='Labor Day').date,'2027-09-06');});
test('Attachment A and B include date rows and totals',()=>{const m=buildModel(baseline());assert.ok(layoutA(m).some(x=>x.r?.type==='day'));assert.ok(layoutB(m).some(x=>x.type==='month'));assert.ok(layoutB(m).some(x=>x.type==='season'));});
test('quoted expiry date cannot precede quote date',()=>{const s=baseline();s.quote.validUntil='2026-01-01';assert.match(buildModel(s).errors.join(' '),/expiration date/);});
test('import parser keeps named quote fields',()=>{
  const parsed=parseHubspot('First Name\nJane\nLast name\nDoe\nEmail\njane@example.com\nCommunity Name\nNorth Test HOA\nCommunity City\nOrlando\nCommunity State/Region\nFL 32801\nDesired Start Date\n06/01/2027\nDesired End Date\n06/30/2027\nView submission in HubSpot');
  assert.equal(parsed.community,'North Test HOA');assert.equal(parsed.email,'jane@example.com');
});
