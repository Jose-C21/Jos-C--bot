// src/commands/golpear.js
export default async function golpear(sock, msg, { usedPrefix = "." }) {
  const chatId = msg?.key?.remoteJid
  if (!chatId) return

  const sender = msg?.key?.participant || msg?.participant || chatId
  const isGroup = String(chatId).endsWith("@g.us")

  try {
    // 📦 Contexto (menciones / reply)
    const ctxInfo = msg?.message?.extendedTextMessage?.contextInfo || {}

    // 🧭 A quién se golpea
    let who = null
    if (ctxInfo?.mentionedJid?.length) {
      who = ctxInfo.mentionedJid[0]
    } else if (ctxInfo?.participant && ctxInfo.participant !== sender) {
      who = ctxInfo.participant
    }

    const name2 = String(sender).split("@")[0] || "Alguien"
    const name = String(who || "").split("@")[0] || "Alguien"

    // 👊 Reacción
    try { await sock.sendMessage(chatId, { react: { text: "👊", key: msg.key } }) } catch {}

    // 🎞 GIFS (mp4 con gifPlayback)
    const gifsDirigido = [
      "https://files.catbox.moe/ywszk8.mp4",
      "https://files.catbox.moe/daf76x.mp4",
      "https://files.catbox.moe/yuwluc.mp4",
      "https://files.catbox.moe/l7tulc.mp4",
      "https://files.catbox.moe/th18fa.mp4",
      "https://files.catbox.moe/s0wfi8.mp4",
      "https://files.catbox.moe/ddf8o8.mp4",
      "https://files.catbox.moe/3t2ivi.mp4",
      "https://files.catbox.moe/12tsrv.mp4"
    ]

    // Si no menciona a nadie (o se menciona a sí mismo)
    if (!who || who === sender) {
      await sock.sendMessage(chatId, {
        text: `⚠️ *@${name2}*, debes mencionar a alguien para golpear.\n\nEjemplo: ${usedPrefix}golpear @usuario`,
        mentions: [sender]
      }, { quoted: msg })
      return
    }

    const texto = `> 👊 *@${name2}* golpea a *@${name}*`
    const gifUrl = gifsDirigido[Math.floor(Math.random() * gifsDirigido.length)]

    await sock.sendMessage(chatId, {
      video: { url: gifUrl },
      gifPlayback: true,
      caption: texto,
      mentions: isGroup ? [who, sender] : [sender]
    }, { quoted: msg })

  } catch (error) {
    console.error("[golpear]", error)
    await sock.sendMessage(chatId, {
      text:
        "❌ *Ocurrió un error al ejecutar el comando golpear.*" +
        "\n\n> ⊱┊*частная система - 𝔍𝔬𝔰𝔢 ℭ*"
    }, { quoted: msg })
  }
}