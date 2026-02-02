// src/utils/jid.js

export function getSenderJid(msg) {
  return msg?.key?.participant || msg?.participant || msg?.key?.remoteJid || ""
}

// ✅ Convierte LID -> JID real usando sock.decodeJid si existe
export function resolveSenderJid(sock, msg) {
  const raw = getSenderJid(msg)
  try {
    if (sock?.decodeJid) return sock.decodeJid(raw)
  } catch {}
  return raw
}

export function jidToNumber(jid = "") {
  const str = String(jid)
  const left = str.split("@")[0]
  return left.replace(/[^0-9]/g, "")
}