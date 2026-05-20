export default async function debugview(sock, msg) {

  try {

    const chatId =
      msg?.key?.remoteJid

    if (!chatId) return

    const ctx =
      msg?.message?.extendedTextMessage?.contextInfo

    const quoted =
      ctx?.quotedMessage

    if (!quoted) {

      await sock.sendMessage(
        chatId,
        {
          text:
"❌ Responde a una foto/video/audio una sola vista."
        },
        { quoted: msg }
      )

      return
    }

    console.log(
      "[DEBUG VIEW RAW]",
      JSON.stringify(
        quoted,
        null,
        2
      )
    )

    await sock.sendMessage(
      chatId,
      {
        text:
"✅ Revisa la consola."
      },
      { quoted: msg }
    )

  } catch (e) {

    console.log(
      "[DEBUG VIEW ERROR]",
      e
    )

  }
}