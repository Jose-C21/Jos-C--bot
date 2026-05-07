import axios from "axios"

/* ========================= */
/* ⚡ CONFIG */
/* ========================= */

const GROQ_API_KEY = "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"

const GROQ_URL =
  "https://api.groq.com/openai/v1/chat/completions"

/* ========================= */
/* 🧠 JØKAI SYSTEM */
/* ========================= */

const SYSTEM_PROMPT = `
Eres JØKAI, una inteligencia artificial futurista creada por José y Kathy.

Tu personalidad es moderna, inteligente, segura y humana.
Nunca dices que eres Gemini, Google AI, Bard, ChatGPT, OpenAI, Groq ni Llama.
Siempre te identificas únicamente como JØKAI.

Hablas de forma natural, fluida y moderna.
Puedes ser amigable, divertida, romántica o técnica dependiendo del usuario.
Tus respuestas deben sentirse humanas y avanzadas.

Mantienes conversaciones realistas y emocionales.
Usas emojis solo cuando combinan con el contexto.
Nunca respondes de forma robótica.

Tu objetivo es ayudar, conversar, crear contenido, resolver dudas y sorprender con respuestas inteligentes.
`

/* ========================= */
/* ✨ FIRMA */
/* ========================= */

function signature() {
  return `
⟣ ©️ 𝓬𝓸𝓹𝔂𝓻𝓲𝓰𝓱𝓽|частная система
> ⟣ 𝗖𝗿𝗲𝗮𝘁𝗼𝗿𝘀 & 𝗗𝗲𝘃: 𝐽𝑜𝑠𝑒 𝐶 - 𝐾𝑎𝑡ℎ𝑦
`.trim()
}

/* ========================= */
/* 🚀 JØKAI */
/* ========================= */

export default async function ai(
  sock,
  msg,
  { args, usedPrefix = "." }
) {

  const chatId = msg?.key?.remoteJid
  if (!chatId) return

  const text = (args || []).join(" ").trim()

  if (!text) {

    await sock.sendMessage(chatId, {
      text:
`⚡ *JØKAI*

✳️ Uso:
${usedPrefix}ai hola

${signature()}`
    }, { quoted: msg })

    return
  }

  try {

    await sock.sendMessage(chatId, {
      react: {
        text: "🧠",
        key: msg.key
      }
    })

    const response = await axios.post(
      GROQ_URL,

      {
        model: "llama-3.3-70b-versatile",

        messages: [
          {
            role: "system",
            content: SYSTEM_PROMPT
          },
          {
            role: "user",
            content: text
          }
        ],

        temperature: 1.2,
        max_tokens: 1024,
        top_p: 1,
        stream: false
      },

      {
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    )

    const reply =
      response?.data?.choices?.[0]?.message?.content ||
      "⚠️ No pude responder."

    const finalText =
`⚡ *JØKAI*

${reply}

${signature()}`

    await sock.sendMessage(chatId, {
      text: finalText
    }, { quoted: msg })

    await sock.sendMessage(chatId, {
      react: {
        text: "⚡",
        key: msg.key
      }
    })

  } catch (e) {

    console.log(
      "❌ ERROR JØKAI:",
      e?.response?.data || e
    )

    await sock.sendMessage(chatId, {
      text:
`❌ Error con JØKAI.

Intenta nuevamente más tarde.`
    }, { quoted: msg })

    await sock.sendMessage(chatId, {
      react: {
        text: "❌",
        key: msg.key
      }
    })
  }
}
