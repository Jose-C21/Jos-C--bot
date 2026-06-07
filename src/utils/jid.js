export function getSenderJid(msg) {
  return msg?.key?.participant || msg?.participant || msg?.key?.remoteJid || ""
}

export function jidToNumber(jid = "") {
  const str = String(jid)
  const left = str.split("@")[0]
  return left.replace(/[^0-9]/g, "")
}

export function isProtectedJid(sock, jid = "", config = {}) {
  const targetNumber = jidToNumber(jid)

  const protectedNumbers = [
    ...(config.owners || []),
    ...(config.ownersLid || []),
    jidToNumber(sock?.user?.id)
  ].map(String)

  return protectedNumbers.includes(
    String(targetNumber)
  )
}