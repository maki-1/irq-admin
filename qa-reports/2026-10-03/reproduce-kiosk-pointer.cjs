// Separates normal pointer inactivity from Flutter accessibility actions.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const qaTemp=path.join(process.env.TEMP,'irequest-qa-20261003');
const {chromium}=require(path.join(qaTemp,'node_modules/playwright'));
const root=path.join(qaTemp,'kiosk-build');
const server=http.createServer((req,res)=>{let file=path.join(root,new URL(req.url,'http://localhost').pathname);if(!file.startsWith(root)){res.writeHead(403);return res.end();}if(!fs.existsSync(file)||fs.statSync(file).isDirectory())file=path.join(root,'index.html');res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.json':'application/json','.wasm':'application/wasm'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);});
(async()=>{
  await new Promise(r=>server.listen(6199,'127.0.0.1',r));
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  const page=await browser.newPage({viewport:{width:1024,height:1366}});
  try{
    await page.goto('http://127.0.0.1:6199/',{waitUntil:'networkidle'});
    await page.waitForTimeout(2500);
    await page.mouse.click(512,874);
    await page.waitForTimeout(500);
    await page.screenshot({path:path.join(__dirname,'screenshots/kiosk-pointer-before-idle.png')});
    await page.waitForTimeout(32000);await page.waitForTimeout(31000);
    await page.locator('flt-semantics-placeholder').evaluate(el=>el.click());
    await page.waitForTimeout(500);
    const snapshot=await page.locator('body').ariaSnapshot();
    const result={mode:'Normal mouse pointer; Flutter accessibility enabled only after 63-second wait',homeVisible:await page.getByRole('button',{name:'Request a Document',exact:true}).isVisible(),snapshot};
    await page.screenshot({path:path.join(__dirname,'screenshots/kiosk-pointer-after-idle.png')});
    fs.writeFileSync(path.join(__dirname,'kiosk-pointer-results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
  }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
