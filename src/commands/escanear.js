export default async function escanear(sock,msg,{isOwner,args}){
const c=msg.key.remoteJid
if(c.endsWith("@g.us")||!isOwner)return
const gs=Object.values(await sock.groupFetchAllParticipating()).sort((a,b)=>a.subject.localeCompare(b.subject))
const r=t=>sock.sendMessage(c,{text:t},{quoted:msg})
const i=parseInt(args[0])
if(!i)return r(`🔎 Elige un grupo:\n\n${gs.map((g,k)=>`${k+1}. ${g.subject}`).join("\n")}\n\nUsa: .escanear <número>`)
const g=gs[i-1]
if(!g)return r("❌ Número inválido.")
await r(`🔎 *${g.subject}*\n👥 Miembros: ${g.participants.length}\n👮 Admins: ${g.participants.filter(p=>p.admin).length}`)}
