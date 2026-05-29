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
`☀️🌻 ¡Ha llegado el momento de premiar a los miembros más activos del conteo! 🌻☀️

🏆 Comienza la premiación...`
})

  await delay(3000)

  console.log("ENVIANDO ORO")

  await sock.sendMessage(
    chatId,
    {
      image: fs.readFileSync(TROFEO_ORO),
      caption:
`☀️ ───── 🌻 ───── ☀️

@${primero.num}

🔊 ${subject} 🔊

Te otorgamos tu...

🥇 𝐏𝐑𝐈𝐌𝐄𝐑 𝐋𝐔𝐆𝐀𝐑 🥇

🏆 Campeón del Conteo de Mensajes

🔥 ${primero.total} mensajes registrados

✨ Tu actividad, constancia y
participación te han llevado
hasta la cima del ranking.

👏 ¡Muchas felicidades!

☀️ ───── 🌻 ───── ☀️`,
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
`☀️ ───── 🌻 ───── ☀️

@${segundo.num}

🔊 ${subject} 🔊

Te otorgamos tu...

🥈 𝐒𝐄𝐆𝐔𝐍𝐃𝐎 𝐋𝐔𝐆𝐀𝐑 🥈

⭐ Subcampeón del Conteo

🔥 ${segundo.total} mensajes registrados

✨ Excelente participación
durante este período.

👏 ¡Sigue así!

☀️ ───── 🌻 ───── ☀️`,
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
`☀️ ───── 🌻 ───── ☀️

@${tercero.num}

🔊 ${subject} 🔊

Te otorgamos tu...

🥉 𝐓𝐄𝐑𝐂𝐄𝐑 𝐋𝐔𝐆𝐀𝐑 🥉

🌟 Participante Destacado

🔥 ${tercero.total} mensajes registrados

✨ Gracias por mantenerte
entre los más activos.

👏 ¡Felicidades!

☀️ ───── 🌻 ───── ☀️`,
      mentions: [tercero.jid]
    }
  )

  await delay(3000)

  await sock.sendMessage(chatId,{
    text:
`🎉 PREMIACIÓN FINALIZADA 🎉

Gracias a todos por participar.

🏆 El conteo se reiniciara en unos minutos...`
  })

  console.log("TOP 1:", primero)
  console.log("TOP 2:", segundo)
  console.log("TOP 3:", tercero)

}