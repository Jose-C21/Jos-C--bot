import axios from "axios"

const RAPID_HOST = "spotify-downloader9.p.rapidapi.com"
const RAPID_KEY = process.env.RAPIDAPI_KEY || "8b004a7ff9msh658214a8fb106f2p1213c3jsn5047c465b710"
const RAPID_HEADERS = { "x-rapidapi-host": RAPID_HOST, "x-rapidapi-key": RAPID_KEY }

// descargador (recibe link de spotify)
const DL_HOST = "spotify-mp3-converter-downloader.p.rapidapi.com"
const DL_HEADERS = { "x-rapidapi-host": DL_HOST, "x-rapidapi-key": RAPID_KEY, "Content-Type": "application/json" }

// firma (la misma que usas)
function signature(){
return `⟣ ©️ 𝓬𝓸𝓹𝔂𝓻𝓲𝓰𝓱𝓽|𝘑𝘊𝘒𝘡𝘐𝘯𝘧𝘪𝘯𝘪𝘵𝘺𝘓𝘰𝘰𝘱
> ⟣ 𝗖𝗿𝗲𝗮𝘁𝗼𝗿𝘀 & 𝗗𝗲𝘃: 𝐽𝑜𝑠𝑒 𝐶 - 𝐾𝑎𝑡ℎ𝑦 𝑍`
}

// buscar canción por nombre (devuelve la 1ra pista)
async function spotSearch(query){

const { data } = await axios.get(`https://${RAPID_HOST}/search`,{
params:{ q:query, type:"tracks", limit:5 },
headers:RAPID_HEADERS,
timeout:30000
})

return data?.data?.tracks?.items?.[0] || null
}

// obtener link de descarga (mp3) con el link de spotify
async function spotLink(id){

const { data } = await axios.post(`https://${DL_HOST}/s/a/track`,
{ url:`https://open.spotify.com/track/${id}` },
{ headers:DL_HEADERS, timeout:60000 })

return data?.data || null
}

// descargar canción
async function spotDownload(url,headers={}){

const r = await axios.get(url,{
responseType:"arraybuffer",
headers,
timeout:120000
})

return Buffer.from(r.data)
}

export default async function spotify(sock,msg,{args=[]}){

const chatId = msg?.key?.remoteJid
if(!chatId) return

const text = args.join(" ").trim()

if(!text){

await sock.sendMessage(chatId,{
text:
`🎧 *SPOTIFY DOWNLOADER*

Uso:
.spotify <nombre de la canción>

Ejemplo:
.spotify Dakiti Bad Bunny

${signature()}`
},{quoted:msg})

return
}

// bloquear links
if(/spotify\.com/.test(text)){
return sock.sendMessage(chatId,{
text:"❌ Solo se permite buscar canciones por nombre."
},{quoted:msg})
}

try{

await sock.sendMessage(chatId,{react:{text:"⏳",key:msg.key}})

// buscar en spotify (API)
const found = await spotSearch(text)

if(!found){
return sock.sendMessage(chatId,{text:"❌ No se encontraron resultados."},{quoted:msg})
}

// link de descarga
const d = await spotLink(found.id)
if(!d?.download?.url) throw "No se pudo obtener el audio"

const song = {
title: d.title || found.name,
artist: d.artist || found.artists?.items?.map(a=>a.profile?.name).filter(Boolean).join(", ") || "Desconocido",
thumbnail: found.albumOfTrack?.coverArt?.slice(-1)[0]?.url || d.cover || null
}

const ms = d.durationMs || found.duration?.totalMilliseconds || 0
const duration = ms ? `${Math.floor(ms/60000)}:${String(Math.floor(ms/1000)%60).padStart(2,"0")}` : "—"

const buffer = await spotDownload(d.download.url,d.download.headers)
console.log(`[spotify] ${(buffer.length/1024/1024).toFixed(2)} MB | esperado ${duration} | ${d.title}`)

// tamaño límite
if(buffer.length / 1024 / 1024 > 30){
return sock.sendMessage(chatId,{
text:"❌ El archivo supera el límite de 30MB."
},{quoted:msg})
}

const caption =
  `╭───〔🟢𝗦𝗣𝗢𝗧𝗜𝗙𝗬🟢〕───╮\n` +
  `│\n` +
  `│  🎶 ${song.title}\n` +
  `│  ───────────────\n` +
  `│  👤 ${song.artist}\n` +
  `│  ⏱ ${duration}\n` +
  `╰───────────────╯\n\n` +

  signature()

// enviar info
if(song.thumbnail){
await sock.sendMessage(chatId,{
image:{url:song.thumbnail},
caption
},{quoted:msg})
}else{
await sock.sendMessage(chatId,{text:caption},{quoted:msg})
}

// enviar audio
await sock.sendMessage(chatId,{
audio:buffer,
mimetype:"audio/mpeg",
fileName:`${song.title} - ${song.artist}.mp3`
},{quoted:msg})

await sock.sendMessage(chatId,{react:{text:"✅",key:msg.key}})

}catch(e){

console.error("[spotify]",e)

await sock.sendMessage(chatId,{
text:`❌ Error: ${e?.response?.data?.message || e?.message || e}`
},{quoted:msg})

try{
await sock.sendMessage(chatId,{react:{text:"❌",key:msg.key}})
}catch{}

}

}
