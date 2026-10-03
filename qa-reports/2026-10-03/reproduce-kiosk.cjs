// Kiosk browser smoke test. Every API response is synthetic; no physical printing.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const qaTemp=path.join(process.env.TEMP,'irequest-qa-20261003');
const {chromium}=require(path.join(qaTemp,'node_modules/playwright'));
const root=path.join(qaTemp,'kiosk-build');
const results={mode:'Flutter kiosk web build; mocked APIs; no printer attached',checks:[],apiCalls:[]};
const server=http.createServer((req,res)=>{
  let file=path.join(root,new URL(req.url,'http://localhost').pathname);
  if(!file.startsWith(root)){res.writeHead(403);return res.end();}
  if(!fs.existsSync(file)||fs.statSync(file).isDirectory())file=path.join(root,'index.html');
  res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.json':'application/json','.wasm':'application/wasm','.png':'image/png'})[path.extname(file)]||'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
async function main(){
  await new Promise(r=>server.listen(6199,'127.0.0.1',r));
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  const context=await browser.newContext({viewport:{width:1024,height:1366}});
  await context.route('**/api/**',route=>{
    const req=route.request(),url=new URL(req.url());results.apiCalls.push({path:url.pathname,method:req.method()});
    let body={},status=200;
    if(url.pathname.endsWith('/clearance/verify'))body={ok:true,clearance:{controlNo:'PC-2345-67',fullName:'QA Resident',purok:'Purok 1'}};
    if(url.pathname.endsWith('/admin/prices')){status=503;body={message:'QA simulated pricing outage'};}
    if(url.pathname.endsWith('/kiosk/requests')){status=201;body={ok:true,controlNo:'PC-2345-67',totalDue:100,requests:[{orNumber:'OR-QA-ONLY'}]};}
    return route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  });
  const page=await context.newPage();results.pageErrors=[];page.on('pageerror',e=>results.pageErrors.push(e.message));
  try{
    await page.goto('http://127.0.0.1:6199/',{waitUntil:'domcontentloaded'});
    await page.locator('flt-semantics-placeholder').waitFor({state:'attached',timeout:30000});
    await page.locator('flt-semantics-placeholder').evaluate(el=>el.click());
    await page.getByRole('button',{name:'Request a Document',exact:true}).waitFor({timeout:30000});
    await page.screenshot({path:path.join(__dirname,'screenshots/kiosk-home-tablet.png')});
    results.checks.push({name:'Home loads',passed:true});
    await page.getByRole('button',{name:'Request a Document',exact:true}).click();
    for(const key of '234567')await page.getByRole('button',{name:key,exact:true}).click();
    await page.getByRole('textbox').fill('Resident');
    await page.getByRole('button',{name:'Continue',exact:true}).click();
    await page.waitForTimeout(500);
    results.documentSnapshot=await page.locator('body').ariaSnapshot();
    await page.getByText('Barangay Clearance',{exact:true}).click();
    await page.waitForTimeout(250);
    results.selectedSnapshot=await page.locator('body').ariaSnapshot();
    await page.getByRole('button',{name:/Purpose/}).click();
    await page.getByRole('menuitem',{name:'Employment',exact:true}).click();
    await page.getByRole('button',{name:'Review',exact:true}).click();
    await page.waitForTimeout(700);
    results.reviewSnapshot=await page.locator('body').ariaSnapshot();
    const submit=page.getByRole('button',{name:'Submit request',exact:true});
    results.checks.push({name:'Submit stays enabled when prices fail',submitEnabled:await submit.isEnabled(),priceVisible:results.reviewSnapshot.includes('100.00')});
    await page.screenshot({path:path.join(__dirname,'screenshots/kiosk-review-pricing-outage.png')});
    await submit.click();
    await page.getByRole('button',{name:'Done',exact:true}).waitFor();
    results.successSnapshot=await page.locator('body').ariaSnapshot();
    results.checks.push({name:'Submission shows server-computed amount',amountShown:results.successSnapshot.includes('100.00')});
    await page.screenshot({path:path.join(__dirname,'screenshots/kiosk-success-tablet.png')});
    await page.getByRole('button',{name:'Done',exact:true}).click();
    await page.getByRole('button',{name:'Request a Document',exact:true}).waitFor();
    results.checks.push({name:'Done returns to home',passed:true});
    await page.getByRole('button',{name:'Request a Document',exact:true}).click();
    results.checks.push({name:'Next resident surname is cleared',value:await page.getByRole('textbox').inputValue()});
    await page.getByRole('button',{name:'2',exact:true}).click();
    // Use real elapsed time: Flutter caches timer functions before a late-installed fake clock.
    await page.waitForTimeout(32000);
    await page.waitForTimeout(31000);
    results.checks.push({name:'60-second idle reset',homeVisible:await page.getByRole('button',{name:'Request a Document',exact:true}).isVisible()});
  }catch(e){results.runError=e.message;results.lastSnapshot=await page.locator('body').ariaSnapshot().catch(()=> '');await page.screenshot({path:path.join(__dirname,'screenshots/kiosk-last-screen.png')}).catch(()=>{});}
  finally{fs.writeFileSync(path.join(__dirname,'kiosk-results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));await browser.close();await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
