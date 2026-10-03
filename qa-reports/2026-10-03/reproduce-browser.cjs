// Browser QA against production builds, with intercepted APIs and synthetic data.
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const qaTemp=path.join(process.env.TEMP,'irequest-qa-20261003');
const {chromium}=require(path.join(qaTemp,'node_modules/playwright'));
const {default:AxeBuilder}=require(path.join(qaTemp,'node_modules/@axe-core/playwright'));
const output=path.join(__dirname,'screenshots');fs.mkdirSync(output,{recursive:true});
function serve(root){
  const server=http.createServer((req,res)=>{
    let file=path.join(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname));
    if(!file.startsWith(root)){res.writeHead(403);return res.end();}
    if(!fs.existsSync(file)||fs.statSync(file).isDirectory())file=path.join(root,'index.html');
    res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.ico':'image/x-icon','.json':'application/json','.wasm':'application/wasm'})[path.extname(file)]||'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve({server,url:`http://127.0.0.1:${server.address().port}`})));
}
const fixtureUser={id:'11111111-1111-4111-8111-111111111111',username:'QA Resident',fullName:'QA Resident',isVerified:true,verificationStatus:'approved',contactVerified:true,isPwd:false,isSenior:false,isIndigent:false};
const fixtureRequests=[{id:'22222222-2222-4222-8222-222222222222',documentType:'Certificate of Residency',purpose:'Employment',status:'Completed',paymentStatus:'paid',amountPaid:50,createdAt:'2026-10-02T10:00:00Z'}];
const results=[];
async function main(){
  const admin=await serve(path.join(qaTemp,'admin-build'));
  const resident=await serve(path.join(qaTemp,'resident-build'));
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  async function scenario({name,site=resident,route='/login',width=1440,height=1000,user,role,outage=false,run,axe=true}){
    if(process.env.QA_SCENARIO_FILTER&&!new RegExp(process.env.QA_SCENARIO_FILTER).test(name))return;
    const context=await browser.newContext({viewport:{width,height}});
    const apiCalls=[],pageErrors=[];
    if(user||role)await context.addInitScript(({user,role})=>{
      const value=role?{user:{id:'11111111-1111-4111-8111-111111111111',fullName:'QA '+role,email:'qa@example.invalid',role},token:'qa-only'}:{user,token:'qa-only'};
      localStorage.setItem(role?'auth-storage':'irequestd-auth',JSON.stringify({state:value,version:0}));
    },{user,role});
    await context.route('**/*',async routeHandler=>{
      const req=routeHandler.request();const url=new URL(req.url());
      if(url.pathname.startsWith('/api/')){
        apiCalls.push({path:url.pathname,method:req.method()});
        if(outage)return routeHandler.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'QA simulated service outage'})});
        let body=[];
        if(url.pathname.includes('/auth/me'))body=fixtureUser;
        else if(url.pathname.includes('/auth/check-'))body={available:true};
        else if(url.pathname.includes('/my/requests/summary'))body={total:1,Pending:0,Processing:0,Printing:0,Completed:1,Claimed:0,Rejected:0};
        else if(url.pathname==='/api/my/requests')body=fixtureRequests;
        else if(url.pathname.includes('/verification/status'))body={status:'approved',fullName:'QA Resident',currentStep:3};
        else if(url.pathname.includes('/admin/prices'))body={'Barangay Clearance':100,'Certificate of Residency':50,'Certificate of Indigency':0};
        else if(url.pathname.includes('/stats'))body={total:0,pending:0,approved:0,rejected:0};
        else if(url.pathname.includes('/unread'))body={count:0};
        else if(url.pathname.includes('/auth/login'))body={token:'qa-only',user:fixtureUser};
        return routeHandler.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
      }
      // Only local bundles and public visual assets may use the network.
      if(url.hostname==='127.0.0.1')return routeHandler.continue();
      if(['res.cloudinary.com','fonts.googleapis.com','fonts.gstatic.com'].includes(url.hostname)){
        try{return await routeHandler.fulfill({response:await routeHandler.fetch({timeout:4000})});}catch{return routeHandler.abort();}
      }
      return routeHandler.abort();
    });
    const page=await context.newPage();page.on('pageerror',e=>pageErrors.push(e.message));
    await page.goto(site.url+route,{waitUntil:'domcontentloaded'});
    await page.waitForTimeout(1700);
    const result={name,viewport:{width,height},urlPath:new URL(page.url()).pathname,pageErrors};
    if(run)result.observations=await run(page);
    result.layout=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth,text:document.body.innerText.slice(0,4500)}));
    if(axe){const scan=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();result.accessibility=scan.violations.map(v=>({id:v.id,impact:v.impact,description:v.description,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}));}
    await page.screenshot({path:path.join(output,name+'.png'),fullPage:true});
    result.apiCalls=apiCalls;results.push(result);
    console.log(JSON.stringify({name,pageErrors,overflow:result.layout.scrollWidth>width,accessibility:result.accessibility?.map(v=>({id:v.id,nodes:v.nodes.length})),observations:result.observations}));
    await context.close();
  }
  try{
    await scenario({name:'admin-login-desktop',site:admin,run:async page=>{
      const paste=await page.locator('input[type=password]').evaluate(el=>{const e=new ClipboardEvent('paste',{bubbles:true,cancelable:true});el.dispatchEvent(e);return {prevented:e.defaultPrevented};});
      await page.getByRole('button',{name:'Sign In',exact:true}).click();
      return {passwordPaste:paste,emptyFormErrors:await page.locator('form').innerText()};
    }});
    await scenario({name:'admin-login-mobile',site:admin,width:390,height:844});
    await scenario({name:'admin-landing-mobile',site:admin,route:'/',width:390,height:844});
    await scenario({name:'resident-login-desktop',run:async page=>{
      const paste=await page.locator('input[type=password]').evaluate(el=>{const e=new ClipboardEvent('paste',{bubbles:true,cancelable:true});el.dispatchEvent(e);return {prevented:e.defaultPrevented};});
      return {passwordPaste:paste};
    }});
    await scenario({name:'resident-signup-mobile',route:'/signup',width:390,height:844});
    await scenario({name:'resident-forgot-mobile',route:'/forgot-password',width:390,height:844});
    await scenario({name:'resident-dashboard-ready-count',route:'/dashboard',user:fixtureUser});
    await scenario({name:'resident-dashboard-outage',route:'/dashboard',user:fixtureUser,outage:true,width:390,height:844});
    await scenario({name:'resident-request-new-mobile',route:'/request/new',user:fixtureUser,width:390,height:844});
    await scenario({name:'resident-requests-mobile',route:'/requests',user:fixtureUser,width:390,height:844});
    await scenario({name:'payment-success-without-reference',route:'/payment/success',axe:false,run:async page=>({successShown:await page.getByText('Payment Successful!',{exact:true}).isVisible()})});
    await scenario({name:'secretary-dashboard-mobile',site:admin,route:'/secretary',role:'Secretary',width:390,height:844});
    await scenario({name:'secretary-dashboard-desktop',site:admin,route:'/secretary',role:'Secretary'});
    await scenario({name:'collector-payments-desktop',site:admin,route:'/collector/payments',role:'Collector'});
    await scenario({name:'collector-reports-desktop',site:admin,route:'/collector/reports',role:'Collector',axe:false});
    await scenario({name:'captain-users-desktop',site:admin,route:'/captain/users',role:'Barangay Captain',axe:false});
    await scenario({name:'captain-documents-desktop',site:admin,route:'/captain/documents',role:'Barangay Captain',axe:false});
    await scenario({name:'purok-requests-desktop',site:admin,route:'/purok-leader/requests',role:'Purok Leader',axe:false});
  }finally{
    const resultFile=path.join(__dirname,'browser-results.json');
    const previous=process.env.QA_SCENARIO_FILTER&&fs.existsSync(resultFile)?JSON.parse(fs.readFileSync(resultFile,'utf8')).results.filter(x=>!results.some(y=>x.name===y.name)):[];
    fs.writeFileSync(resultFile,JSON.stringify({mode:'Local production builds; APIs intercepted; synthetic data; Chrome headless',results:[...previous,...results]},null,2));
    await browser.close();await Promise.all([new Promise(r=>admin.server.close(r)),new Promise(r=>resident.server.close(r))]);
  }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
