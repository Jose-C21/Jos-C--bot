import fs from "fs"
import path from "path"
import { exec } from "child_process"
import { downloadContentFromMessage } from "baileys"
import { Shazam } from "node-shazam"
import yts from "yt-search"
import axios from "axios"

const shazam = new Shazam()

const DVYER_APIKEY = "dvyer090168434816"
const DVYER_API = "https://dvyer-api.com/ytmp3"

const SYLPHY_APIKEY = "sylph-aa4117ac"
const SYLPHY_API = "https://sylphyy.xyz/download/v2/ytmp3"

const RAPID_HOST = "youtube-info-download-api.p.rapidapi.com"
const RAPID_KEY = process.env.RAPIDAPI_KEY || "8b004a7ff9msh658214a8fb106f2p1213c3jsn5047c465b710"
const RAPID_HEADERS = { "x-rapidapi-host": RAPID_HOST, "x-rapidapi-key": RAPID_KEY }

const THUMB_URL = "https://i.postimg.cc/zvGnpW8F/7-C5-CF8-AB-92-E7-45-F5-89-D5-97291-B10761-D.png"

function signature(){
return `⟣ ©️ 𝓬𝓸𝓹𝔂𝓻𝓲𝓰𝓱𝓽|𝘑𝘊𝘒𝘡𝘐𝘯𝘧𝘪𝘯𝘪𝘵𝘺𝘓𝘰𝘰𝘱
> ⟣ 𝗖𝗿𝗲𝗮𝘁𝗼𝗿𝘀 & 𝗗𝗲𝘃: 𝐽𝑜𝑠𝑒 𝐶 - 𝐾𝑎𝑡ℎ𝑦 𝑍`
}

function safeFileName(name=""){
return name.replace(/[^a-zA-Z0-9]/g,"_").slice(0,50)
}

async function fetchBuffer(url){
const r = await fetch(url)
const ab = await r.arrayBuffer()
return Buffer.from(ab)
}

function trad(en = "") {
  const raw = String(en || "").replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "").replace(/\s+/g, " ").trim()
  if (!raw) return "fecha desconocida"
  const s = raw.toLowerCase()
  const es = s.match(/hace .+$/)
  if (es) return es[0]
  if (/^(just now|now)$/.test(s)) return "hace un momento"
  const m = s.match(/(\d+)\s*(years?|yrs?|y|months?|mos?|weeks?|wks?|w|days?|d|hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)\s*ago/)
  if (!m) return raw
  const n = +m[1], k = m[2].slice(0, 2) === "mo" ? "mo" : m[2][0]
  const u = { y: ["año","años"], mo: ["mes","meses"], w: ["semana","semanas"], d: ["día","días"], h: ["hora","horas"], m: ["minuto","minutos"], s: ["segundo","segundos"] }[k]
  return `hace ${n} ${n === 1 ? u[0] : u[1]}`
}

/* 1️⃣ DVYER: pide el link y reintenta hasta que el audio esté listo */
async function dvyerAudio(ytUrl) {
  try {
    const { data } = await axios.get(DVYER_API, {
      params: { mode: "link", url: ytUrl, apikey: DVYER_APIKEY },
      timeout: 30000
    })

    const link = data?.ok && (data.download_url || data.stream_url || data.url)
    if (!link) return null

    for (let i = 0; i < 15; i++) {
      try {
        const r = await axios.get(link, {
          responseType: "arraybuffer",
          timeout: 60000,
          validateStatus: () => true
        })
        const ct = String(r.headers["content-type"] || "")
        if (r.status === 200 && /audio|octet-stream/.test(ct) && r.data.length > 10000) {
          return Buffer.from(r.data)
        }
      } catch {}
      await new Promise(r => setTimeout(r, 3000))
    }
  } catch (err) {
    console.error("❌ ERROR DVYER:", err?.response?.data || err.message)
  }
  return null
}

/* 2️⃣ RAPIDAPI: download -> progress (hasta 1000) -> download_url (MP3) */
async function rapidAudio(ytUrl) {
  try {
    const { data: st } = await axios.get(`https://${RAPID_HOST}/ajax/download.php`, {
      params: { format: "mp3", url: ytUrl },
      headers: RAPID_HEADERS,
      timeout: 30000
    })
    if (!st?.id && !st?.progress_url && !st?.download_url) {
      console.error("❌ RAPID START:", JSON.stringify(st).slice(0, 500))
      return null
    }
    const pUrl = st.progress_url || `https://${RAPID_HOST}/ajax/progress.php?id=${st.id}`
    const pHeaders = st.progress_url ? undefined : RAPID_HEADERS
    let dl = st.download_url || null
    for (let i = 0; i < 40 && !dl; i++) {
      await new Promise(r => setTimeout(r, 3000))
      try {
        const { data: p } = await axios.get(pUrl, { headers: pHeaders, timeout: 20000 })
        if (Number(p?.progress) >= 1000 && p?.success && p?.download_url) dl = p.download_url
      } catch (e) {
        console.error("❌ RAPID PROGRESS:", e?.response?.status || e.message)
      }
    }
    if (!dl) return null
    const r = await axios.get(dl, { responseType: "arraybuffer", timeout: 90000, maxRedirects: 5 })
    const buf = Buffer.from(r.data)
    return buf.length > 10000 ? buf : null
  } catch (err) {
    console.error("❌ ERROR RAPID:", err?.response?.status || "", err?.response?.data?.message || err.message)
    return null
  }
}

/* 3️⃣ SYLPHY: respaldo */
async function sylphyAudio(ytUrl) {
  try {
    const { data } = await axios.get(
      `${SYLPHY_API}?url=${encodeURIComponent(ytUrl)}&api_key=${SYLPHY_APIKEY}`,
      { timeout: 30000 }
    )
    const dl = data?.status && data?.result?.dl_url
    if (!dl) return null
    const bin = await axios.get(dl, { responseType: "arraybuffer", timeout: 60000 })
    return Buffer.from(bin.data)
  } catch (err) {
    console.error("❌ ERROR SYLPHY:", err?.response?.data || err.message)
    return null
  }
}

export default async function detectar(sock,msg){

const chatId = msg?.key?.remoteJid
if(!chatId) return

const ctx = msg?.message?.extendedTextMessage?.contextInfo

if(!ctx?.quotedMessage){
return sock.sendMessage(chatId,{
text:"🎧 Responde a un *audio o video* para detectar la canción."
},{quoted:msg})
}

const quoted = ctx.quotedMessage

const media =
quoted.audioMessage ||
quoted.videoMessage

if(!media?.mimetype || !/audio|video/.test(media.mimetype)){
return sock.sendMessage(chatId,{
text:"❌ El mensaje respondido no es audio ni video."
},{quoted:msg})
}

let infoSent = false

try{

await sock.sendMessage(chatId,{react:{text:"⏳",key:msg.key}})

/* DESCARGAR MEDIA */

const stream = await downloadContentFromMessage(
media,
media.mimetype.startsWith("video") ? "video" : "audio"
)

let buffer = Buffer.from([])

for await(const chunk of stream){
buffer = Buffer.concat([buffer,chunk])
}

/* TMP */

const tmpDir = path.join(process.cwd(),"tmp")
if(!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir)

const input = path.join(tmpDir,`input_${Date.now()}.ogg`)
const output = path.join(tmpDir,`audio_${Date.now()}.wav`)

fs.writeFileSync(input,buffer)

/* FRAGMENTOS SHAZAM */

const stat = fs.statSync(input)
const durationEst = Math.floor(stat.size / 16000)

const fragments = []
fragments.push({start:3,length:12})

if(durationEst > 20){
fragments.push({start:Math.floor(durationEst/2),length:12})
}

if(durationEst > 60){
fragments.push({start:Math.floor(durationEst*0.75),length:12})
}

let track = null

for(const frag of fragments){

await new Promise((resolve,reject)=>{
exec(
`ffmpeg -y -i "${input}" -ss ${frag.start} -t ${frag.length} -ac 2 -ar 44100 "${output}"`,
(err)=> err ? reject(err) : resolve()
)
})

const result = await shazam.recognise(output,"en-US")

if(result?.track){
track = result.track
break
}

}

fs.unlinkSync(input)
fs.unlinkSync(output)

if(!track) throw "No identificado"

/* DATOS */

const title = track.title || "Desconocido"
const artist = track.subtitle || "Desconocido"

let album="N/A"
let genre=track.genres?.primary || "N/A"
let year="N/A"

const section = track.sections?.find(x=>x.type==="SONG")

if(section?.metadata){
for(const meta of section.metadata){

const name = meta.title?.toLowerCase()

if(name.includes("album")) album=meta.text
if(name.includes("released")) year=meta.text

}
}

/* PORTADA */

const cover =
track.images?.coverarthq ||
track.images?.coverart ||
track.images?.background ||
THUMB_URL

/* BUSCAR YOUTUBE */

const search = await yts(`${artist} ${title}`)
if(!search.videos.length) throw "Audio no encontrado"

const video = search.videos[0]

const duration = video.timestamp || "N/A"
const views = Number(video.views).toLocaleString()
const subido = trad(video.uploadedAt || video.ago || "")

/* CACHE */

const cacheDir = path.join(process.cwd(),"cache","play")
if(!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir,{recursive:true})

const clean = safeFileName(video.title)
const filePath = path.join(cacheDir,`${clean}.mp3`)

const thumb2 = await fetchBuffer(THUMB_URL)

const jidUsuario = msg?.key?.participant || msg?.participant || msg?.key?.remoteJid

/* SI EXISTE EN CACHE */

if(fs.existsSync(filePath)){

const fkontak={
key:{
participants:"0@s.whatsapp.net",
remoteJid:"0@s.whatsapp.net",
fromMe:false,
id:"DetectCache"
},
message:{
locationMessage:{
name:video.title,
jpegThumbnail:thumb2,
description:"🎵 Archivo desde caché"
}
},
participant:"0@s.whatsapp.net"
}

await sock.sendMessage(chatId,{
image:{url:cover},
caption:
`╭─ 🎧 𝗖𝗔𝗡𝗖𝗜𝗢́𝗡 𝗗𝗘𝗧𝗘𝗖𝗧𝗔𝗗𝗔
│
│ 🎵 Título: ${title}
│ 👤 Artista: ${artist}
│ 💿 Álbum: ${album}
│ 🎼 Género: ${genre}
│ ⏱ Duración: ${duration}
│ 👁 Vistas: ${views}
│ 📅 Subido: ${subido}
│
│ 🔗 YouTube:
│ ${video.url}
│
╰────────────────╯

${signature()}`
},{quoted:msg})
infoSent = true

await sock.sendMessage(chatId,{
audio:fs.readFileSync(filePath),
mimetype:"audio/mpeg",
contextInfo:{mentionedJid:[jidUsuario]}
},{quoted:fkontak})

await sock.sendMessage(chatId,{react:{text:"⚡",key:msg.key}})
return
}

/* DESCARGA EN PARALELO */

const downloadPromise = (async()=>{

let audioBuf = await dvyerAudio(video.url)
if(!audioBuf) audioBuf = await rapidAudio(video.url)
if(!audioBuf) audioBuf = await sylphyAudio(video.url)
if(!audioBuf) return null

fs.writeFileSync(filePath,audioBuf)
return audioBuf

})().catch(()=>null)

/* ENVIAR CAPTION RÁPIDO */

await sock.sendMessage(chatId,{
image:{url:cover},
caption:
`╭─ 🎧 𝗖𝗔𝗡𝗖𝗜𝗢́𝗡 𝗗𝗘𝗧𝗘𝗖𝗧𝗔𝗗𝗔
│
│ 🎵 Título: ${title}
│ 👤 Artista: ${artist}
│ 💿 Álbum: ${album}
│ 🎼 Género: ${genre}
│ ⏱ Duración: ${duration}
│ 👁 Vistas: ${views}
│ 📅 Subido: ${subido}
│
│ 🔗 YouTube:
│ ${video.url}
│
╰────────────────╯

${signature()}`
},{quoted:msg})
infoSent = true

/* ESPERAR AUDIO */

if(!(await downloadPromise)){
await sock.sendMessage(chatId,{
text:"❌ No fue posible enviar el audio, por favor busca la canción con el comando *.play*"
},{quoted:msg})
await sock.sendMessage(chatId,{react:{text:"❌",key:msg.key}})
return
}

const fkontak={
key:{
participants:"0@s.whatsapp.net",
remoteJid:"0@s.whatsapp.net",
fromMe:false,
id:"DetectNuevo"
},
message:{
locationMessage:{
name:video.title,
jpegThumbnail:thumb2,
description:"⚡ Descargado y guardado en caché"
}
},
participant:"0@s.whatsapp.net"
}

await sock.sendMessage(chatId,{
audio:fs.readFileSync(filePath),
mimetype:"audio/mpeg",
contextInfo:{mentionedJid:[jidUsuario]}
},{quoted:fkontak})

await sock.sendMessage(chatId,{react:{text:"✅",key:msg.key}})

}catch(err){

console.error("[detectar]",err)

await sock.sendMessage(chatId,{
text: infoSent
? "❌ No fue posible enviar el audio, por favor busca la canción con el comando *.play*"
: "❌ No se pudo identificar la canción."
},{quoted:msg})

await sock.sendMessage(chatId,{react:{text:"❌",key:msg.key}})

}

}