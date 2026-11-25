import { proto, generateWAMessageFromContent } from "baileys"

const estructura = {
  tipo: "mensaje",
  contenido: {
    messageContextInfo: {
      messageSecret: "yXuaRSLyRtJ+GhajrMiVjWVo8tgC2nB29jOGDhyWoxc="
    },
    audioStickerMessage: {
      message: {
        stickerMessage: {
          url: "https://mmg.whatsapp.net/v/t62.15575-24/928483854_2200489747533091_7543583530267399461_n.enc?ccb=11-4&oh=01_Q5Aa6AF6ezhOUd80OUiIz2zloYX5NyGcb9UFmWCwGl-ektMJyA&oe=6B2D4CBB&_nc_sid=5e03e0&mms3=true",
          fileSha256: "upnm4Sa1PRLW3Cio1MPNg04Kdktu2Z2JLbPeOJ+qgKw=",
          fileEncSha256: "LFQyho8AimrCd+llhuKDMHaOwUfVdchAnUN0wIzczv4=",
          mediaKey: "r46POdpDo+aJOTE+w+qvjesVffP6HSgi/psGz7HeJHQ=",
          mimetype: "image/webp",
          height: 64,
          width: 64,
          directPath: "/v/t62.15575-24/928483854_2200489747533091_7543583530267399461_n.enc?ccb=11-4&oh=01_Q5Aa6AF6ezhOUd80OUiIz2zloYX5NyGcb9UFmWCwGl-ektMJyA&oe=6B2D4CBB&_nc_sid=5e03e0",
          fileLength: "422546",
          mediaKeyTimestamp: "1795549683",
          firstFrameLength: 422314,
          firstFrameSidecar: "776PKcqGpkIsCw==",
          isAnimated: true,
          contextInfo: {
            mediaDomainInfo: {
              mediaKeyDomain: 1,
              e2EeMediaKey: "r46POdpDo+aJOTE+w+qvjesVffP6HSgi/psGz7HeJHQ="
            }
          },
          audioMessage: {
            url: "https://mmg.whatsapp.net/v/t62.7114-24/917494384_1785223865886579_8008827942548022428_n.enc?ccb=11-4&oh=01_Q5Aa6AEewQKg9c6X4OK8k4SocZX5_4ivune5Eky5lrX4muKPEQ&oe=6B2D5AB0&_nc_sid=5e03e0&mms3=true",
            mimetype: "audio/ogg; codecs=opus",
            fileSha256: "XffH+PaVJkunUjao0x4idD3yu0tyq2ErZmcX4jfM3bw=",
            fileLength: "860498",
            seconds: 146,
            mediaKey: "xIFtVehz4IN+WDG4q1E/p8uXuVcQPAducdTBkFyHEQQ=",
            fileEncSha256: "3/lV/4Qri24J+oUpOX7E2gR9z4GuuwUBDh246Zx+TFg=",
            directPath: "/v/t62.7114-24/917494384_1785223865886579_8008827942548022428_n.enc?ccb=11-4&oh=01_Q5Aa6AEewQKg9c6X4OK8k4SocZX5_4ivune5Eky5lrX4muKPEQ&oe=6B2D5AB0&_nc_sid=5e03e0",
            mediaKeyTimestamp: "1795537882",
            contextInfo: {
              mediaDomainInfo: {
                mediaKeyDomain: 1,
                e2EeMediaKey: "xIFtVehz4IN+WDG4q1E/p8uXuVcQPAducdTBkFyHEQQ="
              }
            },
            waveform: "HyQkIiQjKCopLS8uJVxhX2NgYF5iX19jYF84HRYjMERNS0pCYmNiZGBhWU5NTGJfXVtFYGJfXlUrKS8gGBAIAA=="
          },
          stickerSentTs: "1795549683705",
          isAvatar: false,
          isAiSticker: false,
          isLottie: false,
          premium: 0
        }
      }
    }
  },
  opciones: {}
}

export default async function testAudioSticker(sock, msg) {
  try {
    const chatId = msg?.key?.remoteJid
    if (!chatId) return

    // Verificación rápida en consola de si el schema actual reconoce audioStickerMessage
    console.log("Soporta audioStickerMessage en proto:", Boolean(proto?.Message?.AudioStickerMessage))

    const botJid = sock?.user?.jid || sock?.user?.id
    const mensaje = generateWAMessageFromContent(
      chatId,
      proto.Message.fromObject(estructura.contenido),
      {
        userJid: botJid,
        quoted: msg
      }
    )

    await sock.relayMessage(chatId, mensaje.message, {
      ...estructura.opciones,
      messageId: mensaje.key.id,
      [Symbol.for("enigma.interactive.preserveFormat")]: true
    })
  } catch (err) {
    console.error("❌ Error probando audioStickerMessage:", err)
  }
}