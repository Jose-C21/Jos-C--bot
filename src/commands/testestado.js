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

    let botIsAdmin = "desconocido"
    try {
      const md = await sock.groupMetadata(chatId)
      const botJid = sock?.user?.id
      const botLid = sock?.user?.lid
      const p = md.participants?.find(x =>
        x.id === botJid || x.id === botLid ||
        (botJid && x.id.split("@")[0] === botJid.split("@")[0]) ||
        (botLid && x.id.split("@")[0] === botLid.split("@")[0])
      )
      botIsAdmin = p ? (p.admin === "admin" || p.admin === "superadmin") : "no encontrado en participants"
    } catch (e) {
      botIsAdmin = `error: ${e?.message || e}`
    }

    const debugText =
`🐞 *DEBUG ESTADO (via reply)*
──────────────
chatId: ${chatId}
sender (quien respondió): ${msg.key.participant || "-"}
bot es admin del grupo: ${botIsAdmin}
sock.user.id: ${sock?.user?.id || "-"}
sock.user.lid: ${sock?.user?.lid || "-"}
──────────────
quotedMessage topLevelKeys: ${JSON.stringify(quotedKeys)}
groupStatusMentionMessage directo: ${hasDirect}
dentro de ephemeralMessage: ${hasEphemeral}
dentro de viewOnceMessageV2: ${hasViewOnce}
──────────────
contextInfo COMPLETO (sin filtrar):
${JSON.stringify(ctx, null, 2)}
──────────────
quotedMessage RAW:
${JSON.stringify(quoted, null, 2)}
──────────────
msg.key COMPLETO (del mensaje que respondió, para comparar campos):
${JSON.stringify(msg.key, null, 2)}`

    await sendChunked(sock, chatId, debugText)

    // Intento real de borrado, probando varias construcciones de key
    const targetParticipant = ctx.participant
    const targetId = ctx.stanzaId
    const targetParticipantAlt = ctx.participantAlt || ctx.participantPn || ctx.participant_pn || null

    if (!targetParticipant || !targetId) {
      await sock.sendMessage(chatId, {
        text: "⚠️ No hay participant/stanzaId en el contextInfo, no se puede probar el delete."
      })
      return
    }

    const intentos = [
      {
        nombre: "A) key manual (igual al bug original)",
        key: { remoteJid: chatId, fromMe: false, id: targetId, participant: targetParticipant }
      },
      {
        nombre: "B) key manual + participantAlt/Pn si existe",
        key: targetParticipantAlt
          ? { remoteJid: chatId, fromMe: false, id: targetId, participant: targetParticipant, participantAlt: targetParticipantAlt }
          : null
      }
    ]

    for (const intento of intentos) {
      if (!intento.key) continue

      const delResult = await sock.sendMessage(chatId, { delete: intento.key })
        .catch((e) => ({ __error: e?.message || String(e) }))

      const delText = delResult?.__error
        ? `❌ FALLÓ:\n${delResult.__error}`
        : `✅ result:\n${JSON.stringify(delResult?.key || delResult || "sin respuesta", null, 2)}`

      await sendChunked(sock, chatId, `🐞 *INTENTO ${intento.nombre}*\n──────────────\n${delText}`)
    }

  } catch (e) {
    await sock.sendMessage(chatId, {
      text: `❌ Error en testestado: ${e?.message || String(e)}`
    }).catch(() => {})
    console.error("❌ Error testestado:", e)
  }
}
