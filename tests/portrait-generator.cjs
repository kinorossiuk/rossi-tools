const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const assert = require('node:assert/strict');
const repo = path.resolve(__dirname, '..');
const output = process.env.PORTRAIT_QA_OUTPUT || fs.mkdtempSync('/tmp/rossi-portrait-results-');
fs.mkdirSync(output,{recursive:true});
let assetMode = 'normal';
const server = http.createServer((req,res)=>{
  const pathname = new URL(req.url,'http://localhost').pathname;
  if(pathname === '/') {
    res.setHeader('Content-Type','text/html; charset=utf-8');
    // Run the real client scripts; PHP execution and authentication are outside this check.
    res.end('<!doctype html><meta charset="utf-8"><title>Portrait QA</title>'+fs.readFileSync(repo+'/tools/test-data.php','utf8').replace(/<\?php[\s\S]*?\?>/g,''));
    return;
  }
  if(pathname.includes('fictional-adults')) {
    if(assetMode === 'fail') {res.writeHead(404);res.end();return;}
    if(assetMode === 'delay') {setTimeout(()=>{if(!res.destroyed) res.end(fs.readFileSync(repo+pathname));},1500);return;}
    if(assetMode === 'invalid') {res.end('not an image');return;}
  }
  const target = path.resolve(repo,'.'+pathname);
  if(!target.startsWith(repo+'/') || !fs.existsSync(target)) {res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type', pathname.endsWith('.js')?'application/javascript':pathname.endsWith('.png')?'image/png':pathname.endsWith('.css')?'text/css':'application/octet-stream');
  res.end(fs.readFileSync(target));
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const {chromium} = require('playwright');
 const browser = await chromium.launch({executablePath:process.env.CHROME_BIN || '/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--no-proxy-server']});
 try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror',e=>errors.push(String(e)));
  const evaluate = expression => page.evaluate(expression);
  const base=`http://127.0.0.1:${server.address().port}/`;
  const wait=async(predicate)=>{const deadline=Date.now()+30000;while(Date.now()<deadline){if(await evaluate(predicate))return;await new Promise(r=>setTimeout(r,50));}throw Error('Timeout: '+predicate+' '+await evaluate("JSON.stringify({url:location.href,body:document.body?.innerText.slice(0,1000),status:document.querySelector('#portrait-status')?.textContent})"));};
  const navigate=async()=>{await page.goto(base+'?'+Date.now());await wait("!!document.querySelector('#portrait-generate') && !!window.RossiTestData && document.readyState === 'complete'");};
  const click=async(id)=>{return evaluate(`document.querySelector('#${id}').click()`);};
  const state=()=>evaluate("JSON.parse(localStorage.getItem('rossi-test-data-portrait-groups-v2'))");
  const complete=()=>wait("!document.querySelector('#portrait-generate').disabled");
  const saveZip=async(name)=>{await evaluate("window.RossiTestData.download = async (blob) => { const a = new Uint8Array(await blob.arrayBuffer()); window.zipBase64 = btoa(Array.from(a,b=>String.fromCharCode(b)).join('')); }; window.zipBase64 = null;");await click('portrait-download');await wait('!!window.zipBase64');fs.writeFileSync(output+'/'+name,Buffer.from(await evaluate('window.zipBase64'),'base64'));};
  await navigate();await evaluate("localStorage.clear(); localStorage.setItem('rossi-test-data-portrait-groups-v1',JSON.stringify({version:1,signatures:['old-cartoon'],fileNames:[],lastBatch:{records:[{old:true}]}}))");await navigate();
  assert.equal(await evaluate("document.querySelector('#portrait-groups').disabled"),true);
  await click('portrait-tab');await click('portrait-generate');await complete();
  let s=await state();assert.equal(s.lastBatch.records.length,15);assert.equal(new Set(s.lastBatch.records.map(r=>r.identity.source)).size,3);
  assert.equal(new Set(s.lastBatch.records.map(r=>r.name)).size,15);
  await saveZip('sample.zip');
  await click('portrait-groups');await wait("!document.querySelector('#portrait-groups-output').hidden");
  assert.equal(await evaluate("document.querySelectorAll('.portrait-group').length"),3);
  assert.equal(await evaluate("document.querySelectorAll('#portrait-groups-list img').length"),15);
  await page.locator('#portrait-panel').screenshot({path:output+'/sample.png'});
  await navigate();await click('portrait-groups');await wait("!document.querySelector('#portrait-groups-output').hidden");assert.equal(await evaluate("document.querySelectorAll('.portrait-group').length"),3);
  await evaluate("document.querySelector('#portrait-preset').value='full'; document.querySelector('#portrait-preset').dispatchEvent(new Event('change'))");
  await click('portrait-generate');await complete();s=await state();
  assert.equal(s.lastBatch.records.length,200);assert.equal(new Set(s.lastBatch.records.map(r=>r.identity.source)).size,20);assert.equal(s.fileNames.length,215);
  const counts={};for(const r of s.lastBatch.records)counts[r.person]=(counts[r.person]||0)+1;assert.deepEqual(Object.values(counts),Array(20).fill(10));
  fs.writeFileSync(output+'/full-state.json',JSON.stringify(s));await saveZip('full.zip');
  const before=JSON.stringify(s);await click('portrait-generate');await click('portrait-cancel');await complete();assert.equal(JSON.stringify(await state()),before);
  await click('portrait-reset');assert.equal(await state(),null);assert.equal(await evaluate("document.querySelector('#portrait-download').disabled"),true);
  assetMode='fail';await navigate();await click('portrait-generate');await complete();assert.equal(await state(),null);assert.match(await evaluate("document.querySelector('#portrait-status').textContent"),/불러오지 못/);
  assetMode='invalid';await navigate();await click('portrait-generate');await complete();assert.equal(await state(),null);assert.equal(await evaluate("document.querySelector('#portrait-status').classList.contains('is-error')"),true);
  assetMode='delay';await navigate();await click('portrait-generate');await click('portrait-cancel');await complete();assert.equal(await state(),null);assert.match(await evaluate("document.querySelector('#portrait-status').textContent"),/취소/);
  assetMode='normal';await navigate();await evaluate("Storage.prototype.setItem = function() { throw new DOMException('quota exceeded','QuotaExceededError'); }");await click('portrait-generate');await complete();assert.equal(await state(),null);assert.equal(await evaluate("document.querySelector('#portrait-download').disabled"),true);assert.match(await evaluate("document.querySelector('#portrait-status').textContent"),/저장하지 못/);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({passed:['sample 15 JPGs / 3 identities','full 200 JPGs / 20 identities / 10 each','unique filenames across batches','groups and reload restoration','v1 cartoons excluded','cancel preserves last batch','reset','missing asset','invalid asset','cancel during fetch','storage quota failure','no browser exceptions'],output}));

 } finally {await browser.close();server.closeAllConnections();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.closeAllConnections();server.close();});
