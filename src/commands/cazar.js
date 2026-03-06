// src/commands/cazar.js

import { getSenderJid, jidToNumber } from "../utils/jid.js"
import { addCoins, addXP, addGems, getUserRPG } from "../core/rpgEngine.js"

const SIGNATURE =
"\n\n⟣ ©️ 𝓬𝓸𝓹𝔂𝓻𝓲𝓰𝓱𝓽|частная система\n> ⟣ 𝗖𝗿𝗲𝗮𝘁𝗼𝗿𝘀 & 𝗗𝗲𝘃: 𝐽𝑜𝑠𝑒 𝐶 - 𝐾𝑎𝑡ℎ𝑦"

const IMG_CAZAR =
"https://i.postimg.cc/C5BfKhr7/EE590901-164A-427B-BA1A-83A9E49B32AB.png"

const COOLDOWN = 180000 // 3 minutos

global.cooldownCazar = global.cooldownCazar || {}

function random(min,max){
return Math.floor(Math.random()*(max-min+1))+min
}

export default async function cazar(sock,msg){

try{

const chatId = msg?.key?.remoteJid
if(!chatId) return

const senderJid = getSenderJid(msg)

let decodedJid = senderJid
try{
if(sock?.decodeJid) decodedJid = sock.decodeJid(senderJid)
}catch{}

const senderNum = jidToNumber(decodedJid)

if(!senderNum) return

const keyCooldown = chatId + senderNum
const now = Date.now()

if(global.cooldownCazar[keyCooldown]){

const left = global.cooldownCazar[keyCooldown] - now

if(left > 0){

const sec = Math.ceil(left/1000)

return sock.sendMessage(chatId,{
text:
`╭━ ⏳ 𝗖𝗢𝗢𝗟𝗗𝗢𝗪𝗡 
┃ Debes esperar para volver
┃ a salir de caza
┃
┃ ⏱ Tiempo restante:
┃    ${sec} segundos
╰━━━━━━━━━━━━━╯`
},{quoted:msg})

}

}

global.cooldownCazar[keyCooldown] = now + COOLDOWN

const user = getUserRPG(chatId,senderNum)

// probabilidad de fallar
if(Math.random() < 0.20){

const text =
`╭━ 🏹 𝗖𝗔𝗭𝗔 
┃ Exploraste el bosque...
┃
┃ 😔 No encontraste
┃ ninguna criatura
┃
┃ Intenta nuevamente
┃ más tarde
╰━━━━━━━━━━━━━╯` + SIGNATURE

await sock.sendMessage(chatId,{
image:{url:IMG_CAZAR},
caption:text
},{quoted:msg})

return
}

const coinsReward = random(50,120)
const xpReward = random(8,15)

const coinsAdded = addCoins(chatId,senderNum,coinsReward)
const xpAdded = addXP(chatId,senderNum,xpReward)

let gemText = ""

if(Math.random() < 0.07){

const gemAdded = addGems(chatId,senderNum,1)

if(gemAdded > 0){

gemText =
`\n┃ 💎 Hallazgo raro:
┃    +1 gema`

}

}

const animales = [
"Ciervo",
"Jabalí",
"Lobo salvaje",
"Águila gigante",
"Criatura rara"
]

const animal = animales[random(0,animales.length-1)]

const text =
`╭━ 🏹 𝗖𝗔𝗭𝗔 
┃ 🐾 Encontraste:
┃    ${animal}
┃
┃ 💰 Recompensa:
┃    +${coinsAdded} coins
┃
┃ ⭐ Experiencia:
┃    +${xpAdded} XP${gemText}
┃
┃ 📊 Nivel actual:
┃    ${user.level}
╰━━━━━━━━━━━━━╯` + SIGNATURE

await sock.sendMessage(chatId,{
image:{url:IMG_CAZAR},
caption:text
},{quoted:msg})

}catch(err){

console.error("Error en cazar:",err)

}

}