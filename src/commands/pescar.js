// src/commands/pescar.js

import { getSenderJid, jidToNumber } from "../utils/jid.js"
import { addCoins, addXP, addGems, getUserRPG } from "../core/rpgEngine.js"

const SIGNATURE =
"\n\n⟣ ©️ 𝓬𝓸𝓹𝔂𝓻𝓲𝓰𝓱𝓽|частная система\n> ⟣ 𝗖𝗿𝗲𝗮𝘁𝗼𝗿𝘀 & 𝗗𝗲𝘃: 𝐽𝑜𝑠𝑒 𝐶 - 𝐾𝑎𝑡ℎ𝑦"

const IMG_PESCAR =
"https://i.postimg.cc/mD91jFdZ/46078C43-6806-42AF-902A-205A9EC35848.png"

const COOLDOWN = 120000

global.cooldownPescar = global.cooldownPescar || {}

function random(min,max){
return Math.floor(Math.random()*(max-min+1))+min
}

export default async function pescar(sock,msg){

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

if(global.cooldownPescar[keyCooldown]){

const left = global.cooldownPescar[keyCooldown] - now

if(left > 0){

const sec = Math.ceil(left/1000)

return sock.sendMessage(chatId,{
text:
`╭━ ⏳ 𝗖𝗢𝗢𝗟𝗗𝗢𝗪𝗡
┃ Debes esperar para volver
┃ a pescar
┃
┃ ⏱ Tiempo restante:
┃    ${sec} segundos
╰━━━━━━━━━━━━━╯`
},{quoted:msg})

}

}

global.cooldownPescar[keyCooldown] = now + COOLDOWN

const user = getUserRPG(chatId,senderNum)

const coinsReward = random(20,55)
const xpReward = random(4,7)

const coinsAdded = addCoins(chatId,senderNum,coinsReward)
const xpAdded = addXP(chatId,senderNum,xpReward)

let gemText = ""

if(Math.random() < 0.04){

const gemAdded = addGems(chatId,senderNum,1)

if(gemAdded > 0){

gemText =
`\n┃ 💎 Tesoro marino:
┃    +1 gema`

}

}

const peces = [
"Pez común",
"Trucha",
"Salmón",
"Pez dorado",
"Pez raro"
]

const pez = peces[random(0,peces.length-1)]

const text =
`╭━ 🎣 𝗣𝗘𝗦𝗖𝗔 
┃ 🐟 Capturaste:
┃    ${pez}
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
image:{url:IMG_PESCAR},
caption:text
},{quoted:msg})

}catch(err){

console.error("Error en pescar:",err)

}

}