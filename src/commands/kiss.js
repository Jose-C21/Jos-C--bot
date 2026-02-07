// src/commands/kiss.js
export default async function kiss(sock, msg, { usedPrefix = "." }) {
  const chatId = msg?.key?.remoteJid
  if (!chatId) return

  const sender = msg?.key?.participant || msg?.participant || chatId
  const isGroup = String(chatId).endsWith("@g.us")

  try {
    // 📦 Contexto del mensaje
    const ctxInfo = msg?.message?.extendedTextMessage?.contextInfo || {}

    // 🧭 Detectar objetivo
    let who = null
    if (ctxInfo?.mentionedJid?.length) {
      who = ctxInfo.mentionedJid[0]
    } else if (ctxInfo?.participant && ctxInfo.participant !== sender) {
      who = ctxInfo.participant
    }

    const name2 = String(sender).split("@")[0] || "Alguien"
    const name = String(who || "").split("@")[0] || "Alguien"

    // 💋 Reacción
    try { await sock.sendMessage(chatId, { react: { text: "💋", key: msg.key } }) } catch {}

    // 🎀 GIFs
    const gifsGrupal = [
      "https://files.catbox.moe/vtoocf.mp4",
      "https://files.catbox.moe/dpdkv2.mp4",
      "https://files.catbox.moe/d2isd6.mp4",
      "https://files.catbox.moe/7rq2n1.mp4",
      "https://files.catbox.moe/xasdl7.mp4",
      "https://files.catbox.moe/3ya4l9.mp4"
    ]

    const gifsDirigido = [
      "https://files.catbox.moe/1ih3lq.mp4",
      "https://files.catbox.moe/mi4sn5.mp4",
      "https://files.catbox.moe/o8wdyg.mp4",
      "https://files.catbox.moe/0ontov.mp4",
      "https://files.catbox.moe/86h26k.mp4",
      "https://files.catbox.moe/yiazf5.mp4"
    ]

    // 🔒 limpiar -> números
    const limpiarId = (jid) => String(jid || "").replace(/[^0-9]/g, "")

    const objetivo = limpiarId(who)
    const quienBesa = limpiarId(sender)

    // 💞 CONFIGURACIÓN DE BESOS RESTRINGIDOS (tal cual tu código)
    const kissProtegidos = {
      // Kathy: solo José y Dalila pueden besarla
      "18057074359": ["50432213256", "573043427408", "573244228271"],
      // Kathy LID: solo José LID y Dalila LIDs
      "19580839829625": ["208272208490541", "129004208173107", "245921723977797"],

      // José: nadie puede besarte excepto Kathy
      "50432213256": ["18057074359"],          // tu número -> solo Kathy
      "208272208490541": ["19580839829625"]    // tu NUEVO LID -> solo Kathy LID
    }

    // 🔐 Verificación de protección (solo si hay objetivo)
    if (objetivo && kissProtegidos[objetivo]) {
      const listaPermitidos = kissProtegidos[objetivo]
      if (!listaPermitidos.includes(quienBesa)) {
        await sock.sendMessage(chatId, {
          text: `🚫 *@${name2}*, no tienes permiso para besar a *@${name}* 💢`,
          mentions: who ? [sender, who] : [sender]
        }, { quoted: msg })
        return
      }
    }

    // 💕 Determinar tipo de beso
    let str = ""
    let gifUrl = ""

    if (who && who !== sender) {
      str = `> ❀ *@${name2}* besa a *@${name}* 💋`
      gifUrl = gifsDirigido[Math.floor(Math.random() * gifsDirigido.length)]
    } else {
      str = `> ❀ *@${name2}* reparte besos a todos en el grupo 💋`
      gifUrl = gifsGrupal[Math.floor(Math.random() * gifsGrupal.length)]
    }

    // 📤 Enviar
    await sock.sendMessage(chatId, {
      video: { url: gifUrl },
      gifPlayback: true,
      caption: str,
      mentions: isGroup && who ? [who, sender] : [sender]
    }, { quoted: msg })

  } catch (error) {
    console.error("[kiss]", error)
    await sock.sendMessage(chatId, {
      text:
        "❌ *Ocurrió un error al ejecutar el comando kiss.*" +
        "\n\n⟣ ©️ 𝓬𝓸𝓹𝔂𝓻𝓲𝓰𝓱𝓽|частная система\n> ⟣ 𝗢𝘄𝗻𝗲𝗿: 𝐽𝑜𝑠𝑒 𝐶 - 𝐾𝑎𝑡ℎ𝑦"
    }, { quoted: msg })
  }
}