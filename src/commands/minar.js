// src/commands/minar.js

import { getSenderJid, jidToNumber } from "../utils/jid.js"
import { addCoins, addXP, addGems, getUserRPG } from "../core/rpgEngine.js"

const SIGNATURE =
"\n\n⟣ ©️ 𝓬𝓸𝓹𝔂𝓻𝓲𝓰𝓱𝓽|частная система\n> ⟣ 𝗖𝗿𝗲𝗮𝘁𝗼𝗿𝘀 & 𝗗𝗲𝘃: 𝐽𝑜𝑠𝑒 𝐶 - 𝐾𝑎𝑡ℎ𝑦"

// imagen del juego
const IMG_MINAR =
"https://i.postimg.cc/zXLgx6VG/1813BB99-74F0-4A2C-B427-7D37CE9F10CA.png"

// cooldown
const COOLDOWN = 120000

global.cooldownMinar = global.cooldownMinar || {}

function random(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export default async function minar(sock, msg) {

  try {

    const chatId = msg?.key?.remoteJid
    if (!chatId) return

    // obtener usuario correctamente (compatible lid / jid)
    const senderJid = getSenderJid(msg)

    let decodedJid = senderJid
    try {
      if (sock?.decodeJid) decodedJid = sock.decodeJid(senderJid)
    } catch {}

    const senderNum = jidToNumber(decodedJid)

    if (!senderNum) return

    const keyCooldown = chatId + senderNum
    const now = Date.now()

    // cooldown anti spam
    if (global.cooldownMinar[keyCooldown]) {

      const left = global.cooldownMinar[keyCooldown] - now

      if (left > 0) {

        const sec = Math.ceil(left / 1000)

        return sock.sendMessage(
          chatId,
          {
            text:
`╭━ ⏳ 𝗖𝗢𝗢𝗟𝗗𝗢𝗪𝗡
┃ Debes esperar para volver
┃ a usar este comando
┃
┃ ⏱ Tiempo restante:
┃    ${sec} segundos
╰━━━━━━━━━━━━━━╯`
          },
          { quoted: msg }
        )

      }
    }

    global.cooldownMinar[keyCooldown] = now + COOLDOWN

    const user = getUserRPG(chatId, senderNum)

    // recompensas
    const coinsReward = random(25, 60)
    const xpReward = random(4, 8)

    const coinsAdded = addCoins(chatId, senderNum, coinsReward)
    const xpAdded = addXP(chatId, senderNum, xpReward)

    // probabilidad gema
    let gemText = ""

    if (Math.random() < 0.05) {

      const gemAdded = addGems(chatId, senderNum, 1)

      if (gemAdded > 0) {
        gemText = `\n┃ 💎 Gema encontrada:\n┃    +1 gema`
      }

    }

    const minerales = [
      "Hierro",
      "Carbón",
      "Cobre",
      "Plata",
      "Oro"
    ]

    const mineral = minerales[random(0, minerales.length - 1)]

    const text =
`╭━ ⛏️ 𝗠𝗜𝗡𝗘𝗥𝗜́𝗔 
┃ 🪨 Mineral encontrado:
┃    ${mineral}
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

    await sock.sendMessage(
      chatId,
      {
        image: { url: IMG_MINAR },
        caption: text
      },
      { quoted: msg }
    )

  } catch (err) {

    console.error("Error en minar:", err)

  }
}