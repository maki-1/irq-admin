// Isolated QA: real routes/controllers with in-memory database and service doubles.
// Does not load .env, connect to a database, send messages, or charge a provider.
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const webRoot = path.resolve(__dirname, '../..');
const mobileRoot = 'D:/irequestd';
const mobileRequire = createRequire(path.join(mobileRoot, 'backend/package.json'));
const webRequire = createRequire(path.join(webRoot, 'server/package.json'));
const express = webRequire('express');
const jwt = webRequire('jsonwebtoken');
process.env.JWT_SECRET = 'isolated-qa-fixture-not-a-deployed-secret';
process.env.JWT_EXPIRES_IN = '1h';
process.env.PAYMONGO_WEBHOOK_SECRET = 'isolated-webhook-secret';
function stub(file, value) { const id = require.resolve(file); require.cache[id] = { id, filename: id, loaded: true, exports: value }; }
const id = '11111111-1111-4111-8111-111111111111';
const requestId = '22222222-2222-4222-8222-222222222222';
const findings = [];
let user = {id, username:'qa-resident', password:'fixture', contactNumber:'09999999999', active:false, contactVerified:true, isVerified:true, verificationProfile:{status:'approved'}};
let staff = {id, fullName:'QA Collector', email:'qa@example.invalid', password:'fixture', role:'Collector', active:false};
let writes = [];
let otpLookups = 0;
let otpMatch = false;
const mobileDb = {
  user:{findUnique:async()=>user,update:async({data})=>{writes.push({table:'user',data});return {...user,...data};}},
  admin:{findUnique:async()=>staff},
  otpCode:{findFirst:async()=>{otpLookups++;return {id,code:'fixture'};},update:async({data})=>({id,...data})},
  documentPrice:{upsert:async({create})=>{writes.push({table:'price',data:create});return create;},findUnique:async()=>({pricecentavos:10000})},
  request:{findMany:async()=>[],create:async({data})=>{writes.push({table:'request',data});return {id:requestId,...data};},findFirst:async()=>null},
};
stub(path.join(mobileRoot,'backend/lib/prisma.js'), mobileDb);
stub(path.join(mobileRoot,'backend/lib/password.js'), {comparePassword:async(a)=>a==='incorrect-otp'?otpMatch:true,hashPassword:async()=> 'fixture'});
stub(path.join(mobileRoot,'backend/services/sms.js'), {sendOtp:async()=>{},sendPasswordResetOtp:async()=>{},sendSms:async()=>{}});
stub(path.join(mobileRoot,'backend/services/email.js'), {sendOtpEmail:async()=>{},sendEmail:async()=>{}});
stub(path.join(mobileRoot,'backend/config/cloudinary.js'), {uploadAvatar:{single:()=> (_q,_s,next)=>next()}});
stub(path.join(mobileRoot,'backend/lib/orNumber.js'), {nextOrNumber:async()=> 'QA-ONLY'});
stub(path.join(mobileRoot,'backend/lib/purokNotify.js'), {notifyPurokLeader:async()=>({notified:true})});
const mobileApp=express();
// Same middleware order as backend/server.js.
mobileApp.use(express.json());
mobileApp.use('/api/auth', require(path.join(mobileRoot,'backend/routes/auth.js')));
mobileApp.use('/api/admin', require(path.join(mobileRoot,'backend/routes/admin.js')));
mobileApp.use('/api/requests', require(path.join(mobileRoot,'backend/routes/requests.js')));
mobileApp.use('/api/payment', require(path.join(mobileRoot,'backend/routes/payment.js')));
function response(){return {statusCode:200,status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;}};}
async function main(){
  const server=mobileApp.listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  const call=async(route,{method='GET',body,token,headers={}}={})=>{
    const res=await fetch(base+route,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{ }),...headers},body:body===undefined?undefined:JSON.stringify(body)});
    return {status:res.status,body:await res.json().catch(()=>null)};
  };
  try {
    let r=await call('/api/auth/login',{method:'POST',body:{username:'qa-resident',password:'fixture'}});
    findings.push({test:'Disabled resident login',expected:403,actual:r.status,tokenIssued:!!r.body?.token});
    r=await call('/api/admin/login',{method:'POST',body:{email:'qa@example.invalid',password:'fixture'}});
    findings.push({test:'Disabled staff login on mobile backend',expected:403,actual:r.status,tokenIssued:!!r.body?.token});
    const collectorToken=jwt.sign({id,isAdmin:true,role:'Collector'},process.env.JWT_SECRET);
    writes=[];
    r=await call('/api/admin/prices/Barangay%20Clearance',{method:'PUT',token:collectorToken,body:{pricecentavos:1}});
    findings.push({test:'Collector changes document price via mobile admin API',expected:403,actual:r.status,writes});
    const resetToken=jwt.sign({id,purpose:'reset'},process.env.JWT_SECRET,{expiresIn:'15m'});
    r=await call('/api/auth/me',{token:resetToken});
    findings.push({test:'Password-reset token accepted as access token',expected:401,actual:r.status,profileReturned:r.body?.username==='qa-resident'});
    user={...user,active:true,contactVerified:true,isVerified:false,verificationProfile:{status:'draft'}};
    writes=[];
    r=await call('/api/requests',{method:'POST',token:jwt.sign({id,username:user.username},process.env.JWT_SECRET),body:{documentType:'Barangay Clearance',purpose:'Employment',deliveryMethod:'Pick up at Barangay Office'}});
    findings.push({test:'Draft resident creates request before staff approval',expected:403,actual:r.status,writes});
    const wrongOtpStatuses=[];
    for(let i=0;i<6;i++)wrongOtpStatuses.push((await call('/api/auth/verify-otp',{method:'POST',body:{userId:id,type:'register',code:'incorrect-otp'}})).status);
    findings.push({test:'Six wrong OTP attempts on mobile backend',expected:'Attempt cap / exhausted code',actual:wrongOtpStatuses,databaseLookups:otpLookups});
    writes=[];
    r=await call('/api/auth/verify-otp',{method:'POST',body:{userId:id,type:'register',code:'matching-fixture'}});
    findings.push({test:'Registration OTP changes staff-verification boolean',expected:'contactVerified only',actual:r.status,writes});
    const webhook={data:{attributes:{type:'checkout_session.payment.paid',data:{id:'cs_qa_fixture'}}}};
    const stamp=String(Math.floor(Date.now()/1000));
    const sig=crypto.createHmac('sha256',process.env.PAYMONGO_WEBHOOK_SECRET).update(`${stamp}.${JSON.stringify(webhook)}`).digest('hex');
    r=await call('/api/payment/webhook',{method:'POST',body:webhook,headers:{'paymongo-signature':`t=${stamp},te=${sig}`}});
    findings.push({test:'Valid signature webhook with actual global JSON parser order',expected:200,actual:r.status,message:r.body?.message});
    delete process.env.PAYMONGO_WEBHOOK_SECRET;
    r=await call('/api/payment/webhook',{method:'POST',body:webhook});
    findings.push({test:'Webhook without configured signature secret with same parser order',expected:200,actual:r.status,message:r.body?.message});
  } finally {await new Promise(resolve=>server.close(resolve));}

  const webDb={
    user:{findUnique:async()=>({...user,active:true,contactVerified:true,isVerified:false})},
    request:{create:async({data})=>{writes.push(data);return {id:requestId,...data};},findMany:async()=>[{status:'Completed'},{status:'Completed'}]},
    documentPrice:{findUnique:async()=>({pricecentavos:10000})},
  };
  stub(path.join(webRoot,'server/lib/prisma.js'),webDb);
  stub(path.join(webRoot,'server/src/config/cloudinary.js'),{});
  stub(path.join(webRoot,'server/src/utils/sendSms.js'),async()=>{});
  stub(path.join(webRoot,'server/src/utils/sendEmail.js'),async()=>{});
  stub(path.join(webRoot,'server/src/utils/auditLog.js'),async()=>{});
  stub(path.join(webRoot,'server/src/utils/generateORNumber.js'),async()=> 'QA-ONLY');
  stub(path.join(webRoot,'server/lib/purokNotify.js'),{notifyPurokLeader:async()=>({notified:true})});
  const residentRequests=require(path.join(webRoot,'server/src/controllers/resident.request.controller.js'));
  let r=response();writes=[];
  await residentRequests.createBulk({resident:{id,isPwd:false,isSenior:false,isIndigent:false,isVerified:false},body:{documents:[{type:'Barangay Clearance',purpose:'Employment'}]},files:{}},r);
  findings.push({test:'Paid document through free bulk endpoint',expected:'Server-priced unpaid or rejection',actual:r.statusCode,writes});
  const {residentProtect}=require(path.join(webRoot,'server/src/middleware/residentAuth.js'));
  r=response();let nextCalled=false;
  await residentProtect({headers:{authorization:`Bearer ${jwt.sign({id,role:'resident'},process.env.JWT_SECRET)}`}},r,()=>{nextCalled=true;});
  findings.push({test:'Web middleware allows contact-verified draft account',expected:'Approval gate for request creation',actual:{nextCalled,status:r.statusCode}});
  r=response();await residentRequests.getSummary({resident:{id}},r);
  findings.push({test:'Ready count contract for two Completed requests',expected:2,actualDashboardReady:r.body.ready??r.body.Ready??0,summary:r.body});

  const {redeemClearance}=require(path.join(webRoot,'server/lib/purokClearance.js'));
  let clearanceStatus='issued';
  const faultDb={purokClearance:{updateMany:async()=>{clearanceStatus='used';return {count:1};},findUnique:async()=>({issuedById:id,issuedAt:new Date(),controlNo:'PC-QA-ONLY'})},request:{updateMany:async()=>{throw Error('Injected DB failure after clearance spend');}}};
  let failure='';try{await redeemClearance(id,[requestId],faultDb);}catch(e){failure=e.message;}
  findings.push({test:'Kiosk redemption fails after spending clearance',expected:'Rollback to issued',actual:clearanceStatus,failure});

  writes=[];
  webDb.payment={findFirst:async()=>({id:requestId,sessionId:'cs_qa_fixture'}),update:async({data})=>{writes.push({table:'payment',data});return {id:requestId,amount:100,requests:[{id:requestId}]};}};
  webDb.request.updateMany=async({data})=>{writes.push({table:'request',data});return {count:1};};
  const paymentApp=express();paymentApp.use(express.json());
  paymentApp.use('/api/payments',require(path.join(webRoot,'server/src/routes/payment.routes.js')));
  const paymentServer=paymentApp.listen(0,'127.0.0.1');
  await new Promise(resolve=>paymentServer.once('listening',resolve));
  try{
    const webhookResponse=await fetch(`http://127.0.0.1:${paymentServer.address().port}/api/payments/paymongo/webhook`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:{attributes:{type:'checkout_session.payment.paid',data:{attributes:{checkout_session_id:'cs_qa_fixture'}}}}})});
    findings.push({test:'Unsigned unauthenticated webhook marks payment and request paid',expected:'400/401 and no writes',actual:webhookResponse.status,writes});
  }finally{await new Promise(resolve=>paymentServer.close(resolve));}

  let paymentCount=0,readCount=0,releaseReads;
  const readBarrier=new Promise(resolve=>releaseReads=resolve);
  webDb.request.findUnique=async()=>{if(++readCount===2)releaseReads();await readBarrier;return {id:requestId,userId:id,channel:'kiosk',purokLeaderStatus:'approved',paymentStatus:'unpaid',documentType:'Barangay Clearance'};};
  webDb.request.update=({data})=>Promise.resolve({id:requestId,...data});
  webDb.payment={create:async({data})=>{paymentCount++;return {id:crypto.randomUUID(),...data};}};
  webDb.$transaction=async(operations)=>Promise.all(operations);
  const requests=require(path.join(webRoot,'server/src/controllers/request.controller.js'));
  const r1=response(),r2=response();
  await Promise.all([requests.collectPayment({params:{id:requestId},user:{id,role:'Collector'}},r1),requests.collectPayment({params:{id:requestId},user:{id,role:'Collector'}},r2)]);
  findings.push({test:'Two cash collection calls interleave after unpaid read',expected:'One payment and one conflict',actualStatuses:[r1.statusCode,r2.statusCode],createdPayments:paymentCount,note:'Controlled in-memory interleaving; database concurrency not exercised'});

  let paidRequest={id:requestId,userId:id,documentType:'Barangay Clearance',paymentStatus:'unpaid',status:'Pending',amountPaid:100,purokClearanceFee:50,paymentLinkId:'cs_qa_fixture'};
  stub(webRequire.resolve('axios'),{get:async()=>({data:{data:{attributes:{payment_intent:{attributes:{status:'succeeded'}}}}}})});
  webDb.request.findFirst=async()=>paidRequest;
  webDb.request.update=async({data})=>{paidRequest={...paidRequest,...data};return paidRequest;};
  webDb.payment.updateMany=async()=>({count:1});
  const residentPayment=require(path.join(webRoot,'server/src/controllers/resident.payment.controller.js'));
  r=response();await residentPayment.verifyPayment({resident:{id},params:{requestId}},r);
  findings.push({test:'Payment status polling leaves amountPaid below paid checkout total',expected:{gross:150,collectorDocumentNet:100},actual:{status:r.statusCode,paid:r.body?.paid,storedGross:paidRequest.amountPaid,collectorDocumentNet:Math.max(0,paidRequest.amountPaid-paidRequest.purokClearanceFee)}});
  const controls=[];
  webDb.request.findUnique=async()=>({id:requestId,status:'Pending',paymentStatus:'unpaid'});
  r=response();await requests.updateStatus({params:{id:requestId},body:{status:'Printing'},user:{id}},r);
  controls.push({test:'Main admin API blocks printing unpaid request',expected:400,actual:r.statusCode});
  webDb.request.findUnique=async()=>({id:requestId,status:'Claimed',paymentStatus:'paid'});
  r=response();await requests.updateStatus({params:{id:requestId},body:{status:'Processing'},user:{id}},r);
  controls.push({test:'Main admin API blocks reversing Claimed to Processing',expected:400,actual:r.statusCode});
  const {requireRole}=require(path.join(webRoot,'server/src/middleware/auth.js'));
  r=response();requireRole('Barangay Captain')({user:{role:'Collector'}},r,()=>{});
  controls.push({test:'Main admin role middleware rejects Collector for captain operation',expected:403,actual:r.statusCode});
  r=response();await residentProtect({headers:{}},r,()=>{});
  controls.push({test:'Main resident middleware rejects missing bearer token',expected:401,actual:r.statusCode});
  fs.writeFileSync(path.join(__dirname,'backend-results.json'),JSON.stringify({mode:'Isolated real handlers; synthetic data and service/database doubles',findings,controls},null,2));
  console.log(JSON.stringify(findings,null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
