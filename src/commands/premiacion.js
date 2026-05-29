import fs from "fs"
import { buildRanking } from "./totalmensajes.js"

const TROFEO_ORO = "./assets/premios/trofeo.png"
const TROFEO_PLATA = "./assets/premios/trofeo.png"
const TROFEO_BRONCE = "./assets/premios/trofeo.png"

const delay = (ms) =>
  new Promise(resolve => setTimeout(resolve, ms))

export default async function premiacion(sock, msg) {

  const chatId = msg?.key?.remoteJid

  if (!chatId) return

  const ranking = await buildRanking(sock, chatId)

  const list = ranking.list || []
  const subject = ranking.subject || "Grupo"

  if (list.length < 3) {

    await sock.sendMessage(chatId,{
      text:
      "❌ No hay suficientes participantes para realizar la premiación."
    })

    return
  }

  const primero = list[0]
  const segundo = list[1]
  const tercero = list[2]

  await sock.sendMessage(chatId,{
    text:
`🏆 CEREMONIA DE PREMIACIÓN 🏆

🔊 ${subject} 🔊

Ha llegado el momento de reconocer a los miembros más activos del conteo de mensajes.`
  })

  await delay(3000)

  console.log("ENVIANDO ORO")

  await sock.sendMessage(
    chatId,
    {
      image: fs.readFileSync(TROFEO_ORO),
      caption:
`🌸 Hola, soy Siri

@${primero.num}

🔊 ${subject} 🔊

🥇 PRIMER LUGAR 🥇

👑 CAMPEÓN DEL CONTEO DE MENSAJES 👑

🏆 Felicidades por liderar el ranking de actividad.

🔥 Total de mensajes: ${primero.total}`,
      mentions: [primero.jid]
    }
  )

  await delay(5000)

  console.log("ENVIANDO PLATA")

  await sock.sendMessage(
    chatId,
    {
      image: fs.readFileSync(TROFEO_PLATA),
      caption:
`🌸 Hola, soy Siri

@${segundo.num}

🔊 ${subject} 🔊

🥈 SEGUNDO LUGAR 🥈

⭐ SUBCAMPEÓN DEL CONTEO ⭐

👏 Excelente participación.

🔥 Total de mensajes: ${segundo.total}`,
      mentions: [segundo.jid]
    }
  )

  await delay(5000)

  console.log("ENVIANDO BRONCE")

  await sock.sendMessage(
    chatId,
    {
      image: fs.readFileSync(TROFEO_BRONCE),
      caption:
`🌸 Hola, soy Siri

@${tercero.num}

🔊 ${subject} 🔊

🥉 TERCER LUGAR 🥉

🌟 PARTICIPANTE DESTACADO 🌟

👏 Sigue así.

🔥 Total de mensajes: ${tercero.total}`,
      mentions: [tercero.jid]
    }
  )

  await delay(3000)

  await sock.sendMessage(chatId,{
    text:
`🎉 PREMIACIÓN FINALIZADA 🎉

Gracias a todos por participar.

🏆 El conteo continúa activo.`
  })

  console.log("TOP 1:", primero)
  console.log("TOP 2:", segundo)
  console.log("TOP 3:", tercero)

}