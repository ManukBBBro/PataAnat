const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const FREE_LIMIT = 10;
async function dbGet(u){const r=await fetch(`${SUPABASE_URL}/rest/v1/users?user_id=eq.${u}&select=*`,{headers:{'apikey':SUPABASE_KEY,'Authorization':`Bearer ${SUPABASE_KEY}`}});const d=await r.json();return d?.[0]||null}
async function dbCreate(u){await fetch(`${SUPABASE_URL}/rest/v1/users`,{method:'POST',headers:{'apikey':SUPABASE_KEY,'Authorization':`Bearer ${SUPABASE_KEY}`,'Content-Type':'application/json','Prefer':'return=minimal'},body:JSON.stringify({user_id:u,messages_used:0,is_premium:false})})}
async function dbInc(u,c){await fetch(`${SUPABASE_URL}/rest/v1/users?user_id=eq.${u}`,{method:'PATCH',headers:{'apikey':SUPABASE_KEY,'Authorization':`Bearer ${SUPABASE_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({messages_used:c+1})})}
export default async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS')return res.status(200).end();
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const{system,messages,userId}=req.body||{};
  if(!messages||!userId)return res.status(400).json({error:'Invalid request'});
  let user=await dbGet(userId);
  if(!user){await dbCreate(userId);user={messages_used:0,is_premium:false}}
  const isPremium=user.is_premium,used=user.messages_used||0;
  if(!isPremium&&used>=FREE_LIMIT)return res.status(402).json({error:'limit_reached',messagesUsed:used,limit:FREE_LIMIT});
  const apiKey=process.env.ANTHROPIC_API_KEY;
  if(!apiKey)return res.status(500).json({error:'API key not configured'});
  try{
    const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01'},body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:1024,system:system||'',messages})});
    const data=await r.json();
    if(!r.ok)return res.status(r.status).json({error:data.error?.message});
    await dbInc(userId,used);
    return res.status(200).json({...data,usage_info:{messagesUsed:used+1,limit:FREE_LIMIT,isPremium}});
  }catch(e){return res.status(500).json({error:e.message})}
}
