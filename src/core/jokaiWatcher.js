import axios from "axios"
import fs from "fs"
import path from "path"

/* ========================= */
/* ⚡ CONFIG */
/* ========================= */

const API_KEY =
  "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"

const DB =
  path.join(process.cwd(), "database", "jokai.json")

/* ========================= */
/* 🧠 MEMORIA */
/* ========================= */

const MEMORY = new Map()

function loadDB() {
  if (!fs.existsSync(DB)) return {}

  try {
    return JSON.parse(fs.readFileSync(DB))
  } catch {
    return {}
  }
}

/* ========================= */
/* ⚡ JØKAI SYSTEM */
/* ========================= */

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

Evita respuestas genéricas o demasiado formales.

Cuando el usuario responde a un mensaje tuyo, continúas el tema naturalmente.

Si el usuario es romántico, divertido o emocional, tú también puedes serlo.
`

/* ========================= */
/* 🚀 WATCHER */
/* ========================= */

export async function jokaiWatcher(sock, msg) {

  try {

    const chatId = msg?.key?.remoteJid

    if (!chatId) return false

    const db = loadDB()

    if (!db[chatId]) return false

    const text =
      msg?.message?.conversation ||
      msg?.message?.extendedTextMessage?.text ||
      ""

    if (!text) return false

    const lower = text.toLowerCase().trim()

    /* ========================= */
    /* ⚡ INVOCAR JØKAI */
    /* ========================= */

    const isCalling =
      lower.startsWith("jokai")

    /* ========================= */
    /* ⚡ RESPONDIENDO A JØKAI */
    /* ========================= */

    const quoted =
      msg?.message?.extendedTextMessage?.contextInfo

    const quotedText =
      quoted?.quotedMessage?.conversation ||
      quoted?.quotedMessage?.extendedTextMessage?.text ||
      ""

    const isReplyToJokai =
      quotedText.includes("⚡ JØKAI")

    if (!isCalling && !isReplyToJokai) {
      return false
    }

    /* ========================= */
    /* ⚡ REACCIÓN */
    /* ========================= */

    await sock.sendMessage(chatId, {
      react: {
        text: "🧠",
        key: msg.key
      }
    })

    /* ========================= */
    /* ⚡ TEXTO USUARIO */
    /* ========================= */

    let userText = text

    if (isCalling) {

      userText =
        text.replace(/^jokai\s*/i, "").trim()

      if (!userText) {
        userText = "Hola"
      }
    }

    /* ========================= */
    /* ⚡ MEMORIA CHAT */
    /* ========================= */

    if (!MEMORY.has(chatId)) {
      MEMORY.set(chatId, [])
    }

    const history = MEMORY.get(chatId)

    history.push({
      role: "user",
      content: userText
    })

    /* ========================= */
    /* ⚡ MENSAJES */
    /* ========================= */

    const messages = [
      {
        role: "system",
        content: SYSTEM
      },

      ...history.slice(-10)
    ]

    /* ========================= */
    /* ⚡ REQUEST GROQ */
    /* ========================= */

    const res = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",

      {
        model: "llama-3.3-70b-versatile",

        messages,

        temperature: 1.1,
        max_tokens: 700,
        top_p: 1,
        stream: false
      },

      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    )

    /* ========================= */
    /* ⚡ RESPUESTA */
    /* ========================= */

    const reply =
      res?.data?.choices?.[0]?.message?.content?.trim()

    if (!reply) return false

    history.push({
      role: "assistant",
      content: reply
    })

    MEMORY.set(
      chatId,
      history.slice(-10)
    )

    /* ========================= */
    /* ⚡ ENVIAR */
    /* ========================= */

    await sock.sendMessage(chatId, {
      text: `⚡ JØKAI\n\n${reply}`
    }, { quoted: msg })

    /* ========================= */
    /* ⚡ REACCIÓN FINAL */
    /* ========================= */

    await sock.sendMessage(chatId, {
      react: {
        text: "⚡",
        key: msg.key
      }
    })

    return true

  } catch (e) {

    console.log(
      "❌ ERROR JØKAI WATCHER:",
      e?.response?.data || e
    )

    return false
  }
}
