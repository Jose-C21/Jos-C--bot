export default async function escanear(sock,msg,{isOwner,args}){
const c=msg.key.remoteJid
if(c.endsWith("@g.us")||!isOwner)return
const gs=Object.values(await sock.groupFetchAllParticipating()).sort((a,b)=>a.subject.localeCompare(b.subject))
const r=t=>sock.sendMessage(c,{text:t},{quoted:msg})
const i=parseInt(args[0])
if(!i)return r(`🔎 Elige un grupo:\n\n${gs.map((g,k)=>`${k+1}. ${g.subject}`).join("\n")}\n\nUsa: .escanear <número>`)
const g=gs[i-1]
if(!g)return r("❌ Número inválido.")
try{
const m=await sock.sendMessage(g.id,{text:"🔎 Escaneando grupo..."})
await new Promise(x=>setTimeout(x,2500))
const res=`🔎 *${g.subject}*\n👥 Miembros: ${g.participants.length}\n👮 Admins: ${g.participants.filter(p=>p.admin).length}`
await sock.sendMessage(g.id,{text:res,edit:m.key}).catch(()=>sock.sendMessage(g.id,{text:res}))
await r(`✅ Escaneo enviado a *${g.subject}*`)
}catch{await r("❌ No pude enviar el mensaje al grupo.")}}
