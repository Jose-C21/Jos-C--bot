import axios from "axios"
import yts from "yt-search"
import { gotScraping } from "got-scraping"

const BASE = "https://spotdown.org"

let cachedToken = null
let tokenExpires = 0

// firma (la misma que usas)
function signature(){
return `⟣ ©️ 𝓬𝓸𝓹𝔂𝓻𝓲𝓰𝓱𝓽|частная система\n> ⟣ 𝗖𝗿𝗲𝗮𝘁𝗼𝗿𝘀 & 𝗗𝗲𝘃: 𝐽𝑜𝑠𝑒 𝐶 - 𝐾𝑎𝑡ℎ𝑦`
}

// obtener token sesión
async function getSessionToken(){

if(cachedToken && Date.now() < tokenExpires - 60000) return cachedToken

const r = await gotScraping({
url:`${BASE}/api/get-session-token`,
headers:{
accept:"*/*",
referer:`${BASE}/es3/track`,
origin:BASE
},
timeout:{request:15000}
})

const data = JSON.parse(r.body)

cachedToken = data.token
tokenExpires = data.expires || Date.now() + 3600000

return cachedToken
}

function authHeaders(token){
return{
accept:"*/*",
referer:`${BASE}/es3/track`,
origin:BASE,
"x-session-token":token
}
}

// obtener datos canción
async function spotDetails(query){

const token = await getSessionToken()

const r = await gotScraping({
url:`${BASE}/api/song-details?url=${encodeURIComponent(query)}`,
headers:authHeaders(token),
timeout:{request:15000}
})

return JSON.parse(r.body)
}

// descargar canción
async function spotDownload(url){

const token = await getSessionToken()

const r = await gotScraping({
url:`${BASE}/api/download`,
method:"POST",
headers:{
...authHeaders(token),
"content-type":"application/json"
},
body:JSON.stringify({url}),
timeout:{request:120000},
responseType:"buffer"
})

return r.rawBody
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

// buscar en youtube para obtener metadata
const search = await yts(text)

if(!search.videos.length){
return sock.sendMessage(chatId,{text:"❌ No se encontraron resultados."},{quoted:msg})
}

const video = search.videos[0]

// buscar datos en spotdown
const data = await spotDetails(video.title)

const song = data.songs?.[0]

if(!song){
throw "No se encontró la canción"
}

const buffer = await spotDownload(song.url)

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
  `│  ⏱ ${song.duration}\n` +
  `╰──────────────╯\n` +
   
  signature()

// enviar info
await sock.sendMessage(chatId,{
image:{url:song.thumbnail},
caption
},{quoted:msg})

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
text:`❌ Error: ${e}`
},{quoted:msg})

try{
await sock.sendMessage(chatId,{react:{text:"❌",key:msg.key}})
}catch{}

}

}