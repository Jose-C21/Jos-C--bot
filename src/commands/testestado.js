// src/commands/testestado.js

export default async function testestado(sock, msg) {
  const chatId = msg?.key?.remoteJid
  if (!chatId) return

  const m = msg?.message

  if (!m?.extendedTextMessage?.contextInfo?.quotedMessage) {
    await sock.sendMessage(chatId, {
      text: "❌ Responde al mensaje de estado."
    }, { quoted: msg })
    return
  }

  try {
    const ctx = m.extendedTextMessage.contextInfo
    const quoted = ctx.quotedMessage

    console.log("\n═══════════════[ ESTADO DEBUG ]═══════════════")
    console.log("chatId:", chatId)
    console.log("sender:", msg.key.participant)
    console.log("remoteJid (ctx):", ctx.remoteJid)
    console.log("participant (ctx):", ctx.participant)
    console.log("stanzaId:", ctx.stanzaId)
    console.log("quotedMessage:", JSON.stringify(quoted, null, 2))
    console.log("FULL contextInfo:", JSON.stringify(ctx, null, 2))
    console.log("FULL msg:", JSON.stringify(msg, null, 2))
    console.log("═══════════════════════════════════════════════\n")

    await sock.sendMessage(chatId, {
      text:
`╭─〔 👁️ DEBUG ESTADO 〕─╮
│ ✔ Detectado correctamente
│ ✔ Datos enviados a consola
╰────────────`
    }, { quoted: msg })

  } catch (e) {
    console.error("❌ Error testestado:", e)
  }
}