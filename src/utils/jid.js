export function getSenderJid(msg) {
  return msg?.key?.participant || msg?.participant || msg?.key?.remoteJid || ""
}

export function jidToNumber(jid = "") {
  const str = String(jid)
  const left = str.split("@")[0]
  return left.replace(/[^0-9]/g, "")
}