// src/commands/tesoro.js

import { getSenderJid, jidToNumber } from "../utils/jid.js"
import { addCoins, addXP, addGems, getUserRPG } from "../core/rpgEngine.js"

const SIGNATURE =
"\n\n⟣ ©️ 𝓬𝓸𝓹𝔂𝓻𝓲𝓰𝓱𝓽|частная система\n> ⟣ 𝗖𝗿𝗲𝗮𝘁𝗼𝗿𝘀 & 𝗗𝗲𝘃: 𝐽𝑜𝑠𝑒 𝐶 - 𝐾𝑎𝑡ℎ𝑦"

const IMG_TESORO =
"https://i.postimg.cc/qqs4wWzW/24291E16-5D81-48DA-A2B7-9DA2644F4B1D.png"

const COOLDOWN = 300000 // 5 minutos

global.cooldownTesoro = global.cooldownTesoro || {}

function random(min,max){
return Math.floor(Math.random()*(max-min+1))+min
}

export default async function tesoro(sock,msg){

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

// cooldown
if(global.cooldownTesoro[keyCooldown]){

const left = global.cooldownTesoro[keyCooldown] - now

if(left > 0){

const sec = Math.ceil(left/1000)

return sock.sendMessage(chatId,{
text:
`╭━ ⏳ 𝗖𝗢𝗢𝗟𝗗𝗢𝗪𝗡 
┃ Debes esperar para buscar
┃ otro tesoro
┃
┃ ⏱ Tiempo restante:
┃    ${sec} segundos
╰━━━━━━━━━━━━━╯`
},{quoted:msg})

}

}

global.cooldownTesoro[keyCooldown] = now + COOLDOWN

const user = getUserRPG(chatId,senderNum)

// probabilidad de fallo
if(Math.random() < 0.25){

const text =
`╭━ 🏴‍☠️ 𝗧𝗘𝗦𝗢𝗥𝗢 
┃ Abriste un cofre antiguo...
┃
┃ 😢 Estaba vacío
┃
┃ Sigue explorando
┃ quizás el próximo
┃ tenga riquezas
╰━━━━━━━━━━━━━╯` + SIGNATURE

await sock.sendMessage(chatId,{
image:{url:IMG_TESORO},
caption:text
},{quoted:msg})

return
}

// recompensas
const coinsReward = random(80,180)
const xpReward = random(8,14)

const coinsAdded = addCoins(chatId,senderNum,coinsReward)
const xpAdded = addXP(chatId,senderNum,xpReward)

let gemText = ""

if(Math.random() < 0.12){

const gemAdded = addGems(chatId,senderNum,1)

if(gemAdded > 0){
gemText =
`\n┃ 💎 Gema encontrada:
┃    +1 gema`
}

}

const cofres = [
"Cofre antiguo",
"Cofre pirata",
"Cofre dorado",
"Cofre olvidado"
]

const cofre = cofres[random(0,cofres.length-1)]

const text =
`╭━ 🏴‍☠️ 𝗧𝗘𝗦𝗢𝗥𝗢
┃ 📦 Encontraste:
┃    ${cofre}
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
image:{url:IMG_TESORO},
caption:text
},{quoted:msg})

}catch(err){

console.error("Error en tesoro:",err)

}

}