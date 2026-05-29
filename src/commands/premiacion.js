import { buildRanking } from "./totalmensajes.js"

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

  console.log("TOP 1:", primero)
  console.log("TOP 2:", segundo)
  console.log("TOP 3:", tercero)

}