export default async function detectarSticker(
  sock,
  msg
) {

  try {

    const m =
      msg?.message || {}

    console.log(
      "=========== STICKER DEBUG ==========="
    )

    console.log(
      JSON.stringify(
        m,
        null,
        2
      )
    )

    console.log(
      "=========== KEYS ==========="
    )

    console.log(
      Object.keys(m)
    )

    // EPHEMERAL

    if (
      m?.ephemeralMessage?.message
    ) {

      console.log(
        "EPHEMERAL KEYS:"
      )

      console.log(

        Object.keys(
          m.ephemeralMessage.message
        )
      )
    }

    // VIEWONCE

    if (
      m?.viewOnceMessageV2?.message
    ) {

      console.log(
        "VIEWONCE KEYS:"
      )

      console.log(

        Object.keys(
          m.viewOnceMessageV2.message
        )
      )
    }

    // STICKER DIRECTO

    if (m?.stickerMessage) {

      console.log(
        "STICKER DIRECTO"
      )

      console.log(
        m.stickerMessage
      )
    }

    // DOCUMENTO

    if (m?.documentMessage) {

      console.log(
        "DOCUMENTO"
      )

      console.log(
        m.documentMessage
      )
    }

    await sock.sendMessage(

      msg.key.remoteJid,

      {
        text:
"✅ Revisa la consola."
      }

    )

  } catch (e) {

    console.log(
      "DEBUG ERROR:",
      e
    )
  }
}