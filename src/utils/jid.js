export function getSenderJid(msg) {
  return msg?.key?.participant || msg?.participant || msg?.key?.remoteJid || ""
}

export function jidToNumber(jid = "") {
  return String(jid).replace(/[^0-9]/g, "")
}