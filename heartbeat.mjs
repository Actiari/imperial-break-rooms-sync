if(process.env.GITHUB_REPOSITORY!=='Actiari/imperial-break-rooms-sync'||process.env.GITHUB_REF!=='refs/heads/main'||process.env.SYNC_VISIBILITY!=='public')throw new Error('Public repository required');
const url='https://api.github.com/repos/Actiari/imperial-break-rooms-sync/contents/.heartbeat';
const headers={Authorization:'Bearer '+process.env.GH_TOKEN,Accept:'application/vnd.github+json','Content-Type':'application/json','X-GitHub-Api-Version':'2022-11-28'};
const r=await fetch(url,{headers,signal:AbortSignal.timeout(15000)});if(!r.ok&&r.status!==404)throw new Error('Heartbeat check failed');
const old=r.ok?await r.json():null,last=old?Date.parse(Buffer.from(old.content,'base64').toString()):0;
if(!last||Date.now()-last>=7*86400000){const write=await fetch(url,{method:'PUT',headers,body:JSON.stringify({message:'Keep daily guild sync schedule active',content:Buffer.from(new Date().toISOString()+'\n').toString('base64'),branch:'main',...(old?{sha:old.sha}:{})}),signal:AbortSignal.timeout(15000)});if(!write.ok)throw new Error('Heartbeat update failed');}
