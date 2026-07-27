// src/commands/testestado.js

async function sendChunked(sock, chatId, text, quoted) {
  const MAX = 3500
  if (text.length <= MAX) {
    await sock.sendMessage(chatId, { text }, quoted ? { quoted } : {})
    return
  }
  let i = 0
  let part = 1
  const total = Math.ceil(text.length / MAX)
  while (i < text.length) {
    const chunk = text.slice(i, i + MAX)
    await sock.sendMessage(chatId, {
      text: `[${part}/${total}]\n${chunk}`
    })
    i += MAX
    part++
  }
}

export default async function testestado(sock, msg) {
  const chatId = msg?.key?.remoteJid
  if (!chatId) return

  const m = msg?.message
  const ctx = m?.extendedTextMessage?.contextInfo

  if (!ctx?.quotedMessage) {
    await sock.sendMessage(chatId, {
      text: "❌ Tenés que RESPONDER (citar) el mensaje del estado con .testestado"
    }, { quoted: msg })
    return
  }

  try {
    const quoted = ctx.quotedMessage
    const quotedKeys = Object.keys(quoted)

    const hasDirect = !!quoted?.groupStatusMentionMessage
    const hasEphemeral = !!quoted?.ephemeralMessage?.message?.groupStatusMentionMessage
    const hasViewOnce = !!quoted?.viewOnceMessageV2?.message?.groupStatusMentionMessage

    const debugText =
`🐞 *DEBUG ESTADO (via reply)*
──────────────
chatId: ${chatId}
sender (quien respondió): ${msg.key.participant || "-"}
ctx.participant (dueño del estado): ${ctx.participant || "-"}
ctx.remoteJid: ${ctx.remoteJid || "-"}
ctx.stanzaId (id del msg del estado): ${ctx.stanzaId || "-"}
──────────────
quotedMessage topLevelKeys: ${JSON.stringify(quotedKeys)}
groupStatusMentionMessage directo: ${hasDirect}
dentro de ephemeralMessage: ${hasEphemeral}
dentro de viewOnceMessageV2: ${hasViewOnce}
──────────────
quotedMessage RAW:
${JSON.stringify(quoted, null, 2)}`

    await sendChunked(sock, chatId, debugText)

    // Intento real de borrado, usando los datos del mensaje citado
    const targetParticipant = ctx.participant
    const targetId = ctx.stanzaId

    if (!targetParticipant || !targetId) {
      await sock.sendMessage(chatId, {
        text: "⚠️ No hay participant/stanzaId en el contextInfo, no se puede probar el delete."
      })
      return
    }

    const delResult = await sock.sendMessage(chatId, {
      delete: {
        remoteJid: chatId,
        fromMe: false,
        id: targetId,
        participant: targetParticipant
      }
    }).catch((e) => ({ __error: e?.message || String(e) }))

    const delText = delResult?.__error
      ? `❌ DELETE FALLÓ:\n${delResult.__error}`
      : `✅ DELETE result:\n${JSON.stringify(delResult?.key || delResult || "sin respuesta", null, 2)}`

    await sendChunked(sock, chatId, `🐞 *RESULTADO DELETE*\n──────────────\n${delText}`)

  } catch (e) {
    await sock.sendMessage(chatId, {
      text: `❌ Error en testestado: ${e?.message || String(e)}`
    }).catch(() => {})
    console.error("❌ Error testestado:", e)
  }
}
