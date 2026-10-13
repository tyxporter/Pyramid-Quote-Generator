import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
import ExcelJS from 'exceljs';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
const require = createRequire(import.meta.url);
const html = readFileSync(new URL('../index.html', import.meta.url));
const fakeLogo = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5T8AAAAASUVORK5CYII=', 'base64');

test('browser renders and exports reconciled PDF plus formula-based Excel workbook', async () => {
  const server = createServer((req, res) => {
    if (req.url === '/' || req.url === '/index.html') {res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});res.end(html);return;}
    res.writeHead(404);res.end();
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const port = server.address().port;
  const browser = await chromium.launch({headless:true});
  const folder = mkdtempSync(join(tmpdir(),'pyramid-quote-regression-'));
  const page = await browser.newPage({acceptDownloads:true});
  try {
    await page.route('**/cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', route => route.fulfill({path:require.resolve('jspdf/dist/jspdf.umd.min.js'),contentType:'text/javascript'}));
    await page.route('**/cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js', route => route.fulfill({path:require.resolve('exceljs/dist/exceljs.min.js'),contentType:'text/javascript'}));
    await page.route('**/pyramid-quote-builder.vercel.app/logo.png', route => route.fulfill({body:fakeLogo,contentType:'image/png',headers:{'access-control-allow-origin':'*'}}));
    await page.route('**/fonts.googleapis.com/**', route => route.fulfill({body:'',contentType:'text/css'}));
    await page.goto('http://127.0.0.1:'+port+'/',{waitUntil:'load'});
    const jsErrors = [];
    page.on('pageerror',e=>jsErrors.push(e.message));
    await page.evaluate(()=>{
      const s=window.__pq.state();
      s.client={name:'Test HOA',contact:'Test Manager',email:'test@example.com',phone:'5555555555',address:'123 Test St',city:'Orlando',state:'FL',zip:'32801',description:'Pool monitoring'};
      s.quote={quoteDate:'2026-10-13',validUntil:'2026-11-13',firstDue:'Due upon signing agreement'};
      s.pricing={rateAuto:true,rate:28,premium:14,admin:1500};
      s.phases=[{label:'June',note:'',start:'2027-06-01',end:'2027-06-30',days:Array.from({length:7},(_,i)=>({on:i>=1&&i<=5,start:'10:00',end:'18:00',pools:1}))}];
      s.overrides=[];s.addons=[];s.holidays=[];
      const nameInput=document.querySelector('#f_name');
      nameInput.value='Test HOA';nameInput.dispatchEvent(new Event('input',{bubbles:true}));
    });
    await page.waitForFunction(()=>document.querySelector('#kTotal')?.textContent==='$8,188.00');
    assert.equal(await page.locator('#kHours').textContent(),'176.00');
    assert.equal(await page.locator('#btnPdf').isDisabled(),false);
    assert.deepEqual(jsErrors,[]);
    const [pdfDl]=await Promise.all([page.waitForEvent('download'),page.locator('#btnPdf').click()]);
    const pdfPath=join(folder,'test-quote.pdf');await pdfDl.saveAs(pdfPath);
    const parsed=await pdfParse(readFileSync(pdfPath));
    assert.match(parsed.text,/SERVICE SCHEDULE/);
    assert.match(parsed.text,/INVOICE SCHEDULE/);
    assert.match(parsed.text,/8,188\.00/);
    assert.ok(parsed.numpages>=2);
    const [xlsDl]=await Promise.all([page.waitForEvent('download'),page.locator('#btnXlsx').click()]);
    const xlsPath=join(folder,'test-quote.xlsx');await xlsDl.saveAs(xlsPath);
    const wb=new ExcelJS.Workbook();await wb.xlsx.readFile(xlsPath);
    assert.equal(wb.worksheets.length,2,'Attachment A + B sheets');
    const values=[];let formulas=0;
    for (const sheet of wb.worksheets) sheet.eachRow(row=>row.eachCell(c=>{
      values.push(c.value);if(c.value?.formula) formulas++;
    }));
    assert.ok(formulas>0,'Formula-backed workbook required');
    assert.ok(values.some(v=>v?.result===8188 || v===8188),'Expected validated season total');
  } finally {await page.close();await browser.close();await new Promise(resolve=>server.close(resolve));rmSync(folder,{recursive:true,force:true});}
});
