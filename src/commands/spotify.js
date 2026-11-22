import axios from "axios"
import yts from "yt-search"
import ffmpeg from "fluent-ffmpeg"
import { Readable, PassThrough } from "stream"

const RAPID_HOST = "spotify-downloader-api-music-search-downloads-discovery.p.rapidapi.com"
const RAPID_KEY = process.env.RAPIDAPI_KEY || "8b004a7ff9msh658214a8fb106f2p1213c3jsn5047c465b710"
const RAPID_HEADERS = { "x-rapidapi-host": RAPID_HOST, "x-rapidapi-key": RAPID_KEY }

// firma (la misma que usas)
function signature(){
return `⟣ ©️ 𝓬𝓸𝓹𝔂𝓻𝓲𝓰𝓱𝓽|частная система\n> ⟣ 𝗖𝗿𝗲𝗮𝘁𝗼𝗿𝘀 & 𝗗𝗲𝘃: 𝐽𝑜𝑠𝑒 𝐶 - 𝐾𝑎𝑡ℎ𝑦`
}

// buscar canción por nombre (devuelve 1ra pista con link si está en caché)
async function spotSearch(query){

const { data } = await axios.get(`https://${RAPID_HOST}/search`,{
params:{ q:query, type:"track", limit:10, noOfTopResult:1 },
headers:RAPID_HEADERS,
timeout:30000
})

return data?.tracks?.length ? data.tracks : (data?.topResults || [])
}

// pedir link de descarga (solo si el search no trajo un mp3)
async function spotLink(id){

const { data } = await axios.get(`https://${RAPID_HOST}/downloadSong`,{
params:{ songId:id },
headers:RAPID_HEADERS,
timeout:60000
})

return data?.downloadUrl || data?.data?.downloadUrl || null
}

// descargar canción
async function spotDownload(url){

const r = await axios.get(url,{
responseType:"arraybuffer",
timeout:120000
})

return Buffer.from(r.data)
}

// convertir flac -> mp3 128k con ffmpeg
function toMp3(input){
return new Promise((resolve,reject)=>{
const out = [], pass = new PassThrough()
pass.on("data",d=>out.push(d))
pass.on("end",()=>{
const b = Buffer.concat(out)
b.length>10000 ? resolve(b) : reject("Falló la conversión a mp3")
})
ffmpeg(Readable.from(input))
.noVideo()
.audioCodec("libmp3lame")
.audioBitrate(128)
.outputOptions("-map_metadata","-1")
.format("mp3")
.on("error",reject)
.pipe(pass,{end:true})
})
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
const list = await spotSearch(text)

if(!list.length){
return sock.sendMessage(chatId,{text:"❌ No se encontraron resultados."},{quoted:msg})
}

// link mp3: del search si es mp3, si no (flac/vacío) pedir downloadSong; prueba las siguientes si falla
console.log("[spotify] resultados:",JSON.stringify(list.slice(0,8).map(t=>({id:t.id,t:t.title,u:t.downloadUrl}))))
let song = null, dlUrl = null, flac = null, conv = false
for(const t of list.slice(0,8)){
let u = /\.mp3(\?|$)/i.test(t.downloadUrl || "") ? t.downloadUrl : null
if(!u && !t.downloadUrl && /^[A-Za-z0-9]{22}$/.test(t.id || "")){
try{ u = await spotLink(t.id) }catch(err){ console.error("[spotify] downloadSong",t.id,err?.response?.status,JSON.stringify(err?.response?.data)) }
}
if(u && /\.mp3(\?|$)/i.test(u)){ song = t; dlUrl = u; break }
if(!flac && (u || t.downloadUrl)) flac = { t, u: u || t.downloadUrl }
}
// sin mp3: usar el primer flac y convertirlo a mp3 128k
if(!song && flac){ song = flac.t; dlUrl = flac.u; conv = true }
if(!song) throw "No se pudo obtener el audio"

// miniatura y duración desde youtube (opcional, no bloquea)
let thumb = song.cover || null
let dur = song.duration ? `${Math.floor(song.duration/60000)}:${String(Math.floor(song.duration/1000)%60).padStart(2,"0")}` : null
if(!thumb || !dur){
try{
const v = (await yts({query:`${song.title} ${song.artist}`,hl:"es",gl:"HN"})).videos?.[0]
if(v){ thumb = thumb || v.thumbnail; dur = dur || v.timestamp }
}catch{}
}

let buffer = await spotDownload(dlUrl)
if(conv) buffer = await toMp3(buffer)

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
  `│  ⏱ ${dur || "—"}\n` +
  `╰───────────────╯\n\n` +

  signature()

// enviar info
if(thumb){
await sock.sendMessage(chatId,{
image:{url:thumb},
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
