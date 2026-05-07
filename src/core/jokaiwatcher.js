import axios from "axios"
import fs from "fs"
import path from "path"

const API_KEY = "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"

const DB =
  path.join(process.cwd(), "database", "jokai.json")

const MEMORY = new Map()

function loadDB() {
  if (!fs.existsSync(DB)) return {}
  return JSON.parse(fs.readFileSync(DB))
}

const SYSTEM = `
Eres JØKAI, una inteligencia artificial futurista creada por José y Kathy.

Tu personalidad es natural, humana, inteligente y emocional.
Hablas como una persona real.

Nunca dices que eres una IA, modelo, Groq, OpenAI, Gemini ni nada parecido.

Respondes con excelente ortografía y redacción.
Nunca hablas robóticamente.

Tus respuestas deben sentirse modernas, humanas y fluidas.
Puedes bromear, opinar, conversar y reaccionar naturalmente.

Mantienes coherencia emocional y contextual.

No escribes respuestas exageradamente largas salvo que el usuario lo pida.

A veces usas emojis de forma natural.
`

export async function jokaiWatcher(sock, msg) {

  try {

    const chatId = msg?.key?.remoteJid
    if (!chatId) return

    const db = loadDB()

    if (!db[chatId]) return

    const text =
      msg?.message?.conversation ||
      msg?.message?.extendedTextMessage?.text ||
      ""

    if (!text) return

    const lower = text.toLowerCase()

    const isCalling =
      lower.startsWith("jokai")

    const quoted =
      msg?.message?.extendedTextMessage?.contextInfo

    const isReply =
      quoted?.quotedMessage

    if (!isCalling && !isReply) return

    await sock.sendMessage(chatId, {
      react: {
        text: "🧠",
        key: msg.key
      }
    })

    let userText = text

    if (isCalling) {
      userText =
        text.replace(/^jokai\s*/i, "").trim()
    }

    if (!userText) {
      userText = "Hola"
    }

    if (!MEMORY.has(chatId)) {
      MEMORY.set(chatId, [])
    }

    const history = MEMORY.get(chatId)

    history.push({
      role: "user",
      content: userText
    })

    const messages = [
      {
        role: "system",
        content: SYSTEM
      },
      ...history.slice(-10)
    ]

    const res = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",

      {
        model: "llama-3.3-70b-versatile",
        messages,
        temperature: 1,
        max_tokens: 700
      },

      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    )

    const reply =
      res.data.choices[0].message.content

    history.push({
      role: "assistant",
      content: reply
    })

    MEMORY.set(chatId, history.slice(-10))

    await sock.sendMessage(chatId, {
      text: `⚡ JØKAI\n\n${reply}`
    }, { quoted: msg })

    await sock.sendMessage(chatId, {
      react: {
        text: "⚡",
        key: msg.key
      }
    })

  } catch (e) {

    console.log(
      "❌ ERROR JØKAI WATCHER:",
      e?.response?.data || e
    )
  }
}
