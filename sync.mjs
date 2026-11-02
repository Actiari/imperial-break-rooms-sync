import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
const origin='https://imperialbreakrooms.pages.dev';
const repository='Actiari/imperial-break-rooms-sync';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export async function requestJson(url,init={},options={}){
  const {attempts=3,fetcher=fetch,wait=sleep,timeoutMs=15000}=options;
  for(let attempt=0;attempt<attempts;attempt++){
    let response;
    try{response=await fetcher(url,{...init,signal:AbortSignal.timeout(timeoutMs)});}catch{
      if(attempt+1===attempts)throw new Error('Upstream connection failed');
      await wait(1000*2**attempt);continue;
    }
    if(response.ok)return response.json();
    const transient=response.status===408||response.status===429||response.status>=500;
    const header=response.headers.get('Retry-After'),retry=header&&/^\d+$/.test(header)?Number(header)*1000:header?Date.parse(header)-Date.now():0;
    const delay=Math.max(1000*2**attempt,Number.isFinite(retry)?retry:0);
    if(!transient||attempt+1===attempts||delay>60000)throw new Error('Upstream request failed: HTTP '+response.status);
    await wait(delay);
  }
  throw new Error('Upstream connection failed');
}
export function rosterSnapshot(raw,profiles,now=Date.now()){
  const guild=raw.guild??raw,profile=guild.profile;
  if(profile?.id!=='nGnTt-BHQf2sGRMiZ0rT_g'||!Array.isArray(guild.member)||guild.member.length!==Number(profile.memberCount)||guild.member.length<1||guild.member.length>50)throw new Error('Incomplete guild profile');
  const members=guild.member.map(m=>{
    const p=profiles.get(m.playerId)??m;
    if(p.playerId!==m.playerId||!/^\d{9}$/.test(String(p.allyCode)))throw new Error('Player identity unavailable');
    const joined=Number(m.guildJoinTime),active=Number(m.lastActivityTime);
    return {playerId:m.playerId,name:m.playerName,allyCode:String(p.allyCode),gp:Number(m.galacticPower),joined:joined>0?new Date(joined*1000).toISOString().slice(0,10):null,lastActive:active>0?new Date(active).toISOString():null};
  });
  return {guildId:profile.id,memberCount:members.length,fetchedAt:now,members,source:{recentRaidResult:guild.recentRaidResult??[],recentTerritoryWarResult:guild.recentTerritoryWarResult??[],guildEventTracker:profile.guildEventTracker??[],memberActivity:guild.member.map(m=>({playerId:m.playerId,memberContribution:m.memberContribution??[],seasonStatus:m.seasonStatus??[]}))}};
}
async function idToken(){
  const target=new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL);target.searchParams.set('audience',origin);
  const data=await requestJson(target,{headers:{Authorization:'Bearer '+process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}});if(typeof data.value!=='string')throw new Error('Runner identity unavailable');return data.value;
}
async function tracker(path,body){
  const token=await idToken();return requestJson(origin+'/api/sync/'+path,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)},{attempts:path==='claim'?1:3,timeoutMs:30000});
}
async function comlink(endpoint,payload){
  return requestJson('http://127.0.0.1:3500/'+endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({payload,enums:false})},{timeoutMs:45000});
}
export async function main(){
  if(process.env.GITHUB_REPOSITORY!==repository||process.env.GITHUB_REF!=='refs/heads/main'||process.env.SYNC_VISIBILITY!=='public')throw new Error('Public repository required');
  const work=await tracker('claim',{});if(!work){console.log('No guild update due.');return;}
  let started=false;
  try{
    const start=spawnSync('docker',['run','-d','--name','swgoh-comlink','--env','APP_NAME=ibr-guild-tracker','-p','127.0.0.1:3500:3000','ghcr.io/swgoh-utils/swgoh-comlink:latest'],{stdio:'pipe',timeout:180000});if(start.status!==0)throw new Error('Comlink startup failed');started=true;
    let ready=false;for(let i=0;i<36;i++){try{const r=await fetch('http://127.0.0.1:3500/enums',{signal:AbortSignal.timeout(3000)});if(r.ok){ready=true;break;}}catch{}await sleep(3000);}if(!ready)throw new Error('Comlink startup timed out');
    const raw=await comlink('guild',{guildId:work.guildId,includeRecentGuildActivityInfo:true}),guild=raw.guild??raw;
    if(guild.profile?.id!==work.guildId||!Array.isArray(guild.member)||guild.member.length>50)throw new Error('Unexpected guild response');
    const profiles=new Map();let cursor=0;
    await Promise.all(Array.from({length:3},async()=>{while(cursor<guild.member.length){const m=guild.member[cursor++];if(m.allyCode){profiles.set(m.playerId,m);continue;}const rawPlayer=await comlink('player',{playerId:m.playerId}),p=rawPlayer.player??rawPlayer;profiles.set(m.playerId,p);await sleep(150);}}));
    const snapshot=rosterSnapshot(raw,profiles);await tracker('complete',{lease:work.lease,snapshot});console.log('Guild update completed. Members: '+snapshot.memberCount);
  }catch(error){try{await tracker('complete',{lease:work.lease,failed:true});}catch{}throw error;
  }finally{if(started)spawnSync('docker',['rm','-f','swgoh-comlink'],{stdio:'ignore',timeout:15000});}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(error=>{console.error(error.message);process.exitCode=1;});
