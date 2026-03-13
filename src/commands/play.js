import fs from "fs"
import path from "path"
import yts from "yt-search"
import axios from "axios"
import config from "../config.js"

const APIKEY = "sk_2fea7c1a-0c7d-429c-bbb7-7a3b936ef4f4"
const API_RESOLVE = "https://api-sky.ultraplus.click/youtube/resolve"

const CARD_IMAGE_URL = "https://i.postimg.cc/TwGh4vDP/IMG-1651.png"
const THUMB_URL = "https://i.postimg.cc/zvGnpW8F/7-C5-CF8-AB-92-E7-45-F5-89-D5-97291-B10761-D.png"

function trad(en = "") {

const map = {
"years ago":"años",
"year ago":"año",
"months ago":"meses",
"month ago":"mes",
"weeks ago":"semanas",
"week ago":"semana",
"days ago":"días",
"day ago":"día",
"hours ago":"horas",
"hour ago":"hora",
"minutes ago":"minutos",
"minute ago":"minuto",
"seconds ago":"segundos",
"second ago":"segundo"
}

const out = Object.entries(map).reduce((t,[e,es])=>{
return t.replace(new RegExp(`\\b${e}\\b`,"g"),es)
},en||"")

return ("hace " + out).trim()

}

function safeFileName(name=""){
return name.replace(/[^a-zA-Z0-9]/g,"_").slice(0,50) || "audio"
}

async function fetchBuffer(url){

const r = await fetch(url)
if(!r.ok) throw new Error(`fetch failed ${r.status}`)

const ab = await r.arrayBuffer()
return Buffer.from(ab)

}

function signature(){

return `⟣ ©️ 𝓬𝓸𝓹𝔂𝓻𝓲𝓰𝓱𝓽|частная система
> ⟣ 𝗖𝗿𝗲𝗮𝘁𝗼𝗿𝘀 & 𝗗𝗲𝘃: 𝐽𝑜𝑠𝑒 𝐶 - 𝐾𝑎𝑡ℎ𝑦`

}

export default async function play(sock,msg,{args,usedPrefix="."}){

const chatId = msg?.key?.remoteJid
if(!chatId) return

const text = (args || []).join(" ").trim()

const cacheDir = path.join(process.cwd(),"cache","play")
if(!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir,{recursive:true})

if(!text){

await sock.sendMessage(chatId,{
text:`✳️ Uso:\n*${usedPrefix}play* <título o artista>\n\n${signature()}`
},{quoted:msg})

return
}

try{

await sock.sendMessage(chatId,{react:{text:"⏳",key:msg.key}})

/* BUSCAR YOUTUBE */

const res = await yts(text)
if(!res?.videos?.length) throw "Sin resultados"

const video = res.videos[0]

const title = video.title
const ytUrl = video.url
const timestamp = video.timestamp
const views = video.views || 0
const subido = trad(video.uploadedAt || video.ago || "")
const allArtists = video.author?.name || "Artista desconocido"

const clean = safeFileName(title)
const filePath = path.join(cacheDir,`${clean}.mp3`)

const finalCaption =
`🔘 ᴛɪᴛᴜʟᴏ: ${title}\n\n`+
`🔘 ᴀʀᴛɪꜱᴛᴀ: ${allArtists}\n\n`+
`🔘 ᴅᴜʀᴀᴄɪᴏɴ: ${timestamp}\n\n`+
`👁 ${Number(views).toLocaleString()} • 📅 ${subido}\n\n`+
signature()

const thumb2 = await fetchBuffer(THUMB_URL)

const jidUsuario = msg?.key?.participant || msg?.participant || msg?.key?.remoteJid

await sock.sendMessage(chatId,{
image:{url:CARD_IMAGE_URL},
caption:finalCaption
},{quoted:msg})

/* CACHE */

if(fs.existsSync(filePath)){

console.log("⚡ AUDIO DESDE CACHE:",filePath)

const fkontakAudio={
key:{
participants:"0@s.whatsapp.net",
remoteJid:"0@s.whatsapp.net",
fromMe:false,
id:"PlayCache"
},
message:{
locationMessage:{
name:title,
jpegThumbnail:thumb2,
description:"🎵 Archivo desde caché"
}
},
participant:"0@s.whatsapp.net"
}

await sock.sendMessage(chatId,{
audio:fs.readFileSync(filePath),
mimetype:"audio/mp3",
contextInfo:{mentionedJid: jidUsuario ? [jidUsuario] : []}
},{quoted:fkontakAudio})

await sock.sendMessage(chatId,{react:{text:"⚡",key:msg.key}})
return

}

/* API SKYULTRAPLUS */

console.log("\n🌐 ENVIANDO A API:")
console.log(ytUrl)

const apiRes = await axios.post(
API_RESOLVE,
{url:ytUrl,type:"audio",format:"mp3"},
{
headers:{
"Content-Type":"application/json",
apikey:APIKEY
}
}
)

console.log("\n📡 RESPUESTA API:")
console.log(JSON.stringify(apiRes.data,null,2))

const result = apiRes.data?.result || apiRes.data?.data

let audioUrl = result?.media?.dl_download || result?.media?.direct

if(!audioUrl) throw "No se pudo obtener el audio"

/* FIX URL RELATIVA */

if(audioUrl.startsWith("/")){
audioUrl = "https://api-sky.ultraplus.click" + audioUrl
}

console.log("\n🔗 URL FINAL AUDIO:")
console.log(audioUrl)

/* DESCARGAR */

const bin = await axios.get(audioUrl,{
responseType:"arraybuffer",
timeout:60000,
headers:{apikey:APIKEY}
})

console.log("\n📦 HEADERS AUDIO:")
console.log(bin.headers)

console.log("\n📏 TAMAÑO AUDIO:")
console.log(bin.data.length,"bytes")

fs.writeFileSync(filePath,Buffer.from(bin.data))

console.log("\n💾 AUDIO GUARDADO EN:")
console.log(filePath)

const fkontakAudio={
key:{
participants:"0@s.whatsapp.net",
remoteJid:"0@s.whatsapp.net",
fromMe:false,
id:"PlayNuevo"
},
message:{
locationMessage:{
name:title,
jpegThumbnail:thumb2,
description:"⚡ Descargado y guardado en caché"
}
},
participant:"0@s.whatsapp.net"
}

await sock.sendMessage(chatId,{
audio:fs.readFileSync(filePath),
mimetype:"audio/mp3",
contextInfo:{mentionedJid: jidUsuario ? [jidUsuario] : []}
},{quoted:fkontakAudio})

await sock.sendMessage(chatId,{react:{text:"✅",key:msg.key}})

}catch(e){

console.error("\n❌ ERROR PLAY:")
console.error(e)

await sock.sendMessage(chatId,{
text:`❌ *Error:* ${e}`
},{quoted:msg})

await sock.sendMessage(chatId,{react:{text:"❌",key:msg.key}})

}

}