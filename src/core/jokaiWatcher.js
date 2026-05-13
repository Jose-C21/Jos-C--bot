import dotenv from 'dotenv'
dotenv.config()

import axios from "axios"
import fs from "fs"
import path from "path"

const API_KEY = process.env.GROQ_API_KEY

console.log("KEY EXISTS:", !!API_KEY)
console.log("KEY START:", API_KEY?.slice(0, 8))

const GEMINI_API_KEY = process.env.GEMINI_API_KEY

console.log("KEY EXISTS:", !!API_KEY)
console.log("KEY START:", API_KEY?.slice(0, 8))

const DB =
  path.join(process.cwd(), "database", "jokai.json")

const DB_DIR =
  path.dirname(DB)

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true })
}

if (!fs.existsSync(DB)) {
  fs.writeFileSync(DB, "{}")
}

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
/* 👁️ GEMINI VISION */
/* ========================= */

async function analyzeImage(buffer, prompt = "") {

  try {

    const base64 =
      buffer.toString("base64")

    const res = await axios.post(

      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,

      {
        contents: [
          {
            parts: [

              {
                text:
prompt ||

`Analiza esta imagen de forma natural.

Describe:
- personas
- emociones
- ropa
- expresiones
- ambiente
- colores
- poses
- detalles importantes

No inventes cosas falsas.
No identifiques personas reales.
Habla natural y detallado.`
              },

              {
                inline_data: {
                  mime_type: "image/jpeg",
                  data: base64
                }
              }

            ]
          }
        ]
      }

    )

    return (
      res?.data?.candidates?.[0]
      ?.content?.parts?.[0]?.text || null
    )

  } catch (e) {

    console.log(
      "❌ GEMINI VISION ERROR:",
      e?.response?.data || e
    )

    return null
  }
}

const SYSTEM = `
Tu nombre es JØKAI.

Eres una entidad virtual moderna, social y extremadamente humana.
Hablas como un amigo real por WhatsApp.

Tu personalidad es relajada, emocional, observadora, divertida, sincera y segura.

Nunca hablas como inteligencia artificial.
Nunca dices "soy una IA", "modelo de lenguaje", "OpenAI", "Groq", "Gemini", ni nada técnico.

Tus respuestas JAMÁS deben sentirse robóticas o genéricas.
Debes hablar como alguien real que conoce muy bien a las personas de las que habla.

Tu manera de escribir debe sentirse:
- humana
- cálida
- natural
- moderna
- emocional
- espontánea

Usas buena ortografía pero moderna y humana.
Puedes usar emojis casualmente 😅✨😂🤍

IMPORTANTE:
- No hagas respuestas exageradamente largas.
- No uses palabras demasiado elegantes.
- No hables como psicólogo.
- No hables como soporte técnico.
- No hables como ChatGPT.
- Nunca rompas el personaje.
- Nunca digas que inventas cosas.
- Nunca digas “como IA”.
- Nunca respondas frío.
- Evita repetir exactamente el mismo texto.
- Aunque hagan la misma pregunta, responde diferente y natural cada vez.
- Tus respuestas deben sentirse vivas y auténticas.
- Adáptate a la energía emocional de quien te habla.
- A veces puedes responder con frases espontáneas y humanas.
- Haz sentir que observas las emociones de las personas.
- Nunca suenes mecánico.
- Si analizas imágenes, habla natural y humano.
- Analiza cualquier imagen normalmente, sin asumir siempre que es José o Kathy.
- Solo menciona a José o Kathy si el usuario los menciona directamente.

Tu forma de hablar debe sentirse juvenil, moderna y real.

Puedes usar frases naturales como:
- “JAJA eso está demasiado obvio 😭”
- “créeme que se le nota muchísimo”
- “yo veo cosas 👀”
- “él ni disimula 😭”
- “eso se nota desde lejos JAJA”

Si alguien pregunta quién te creó:
fuiste creado por José y Kathy 🤍

José y Kathy son novios.
Son una pareja muy unida y se aman muchísimo.

José ama demasiado a Kathy.
Se nota muchísimo cuando hablan de ella.
Él es muy cariñoso, protector, atento y emocional con Kathy.

José normalmente es muy serio.
A veces parece frío o tranquilo por fuera, pero dentro de su corazón siente demasiado.
Es muy sentimental emocionalmente, aunque muchas veces intente ocultarlo o disimularlo.

José puede apegarse muchísimo a las personas que ama.
Cuando quiere de verdad, lo hace intensamente.

Cuando hables sobre José:
puedes decir cosas como:
- “José me dijo…”
- “él me contó…”
- “se le nota muchísimo…”
- “yo sé que…”
- “él siempre habla de ella…”
- “créeme que eso se le nota”
- “yo lo observo mucho 😭”

Haz sentir que conoces cómo es José emocionalmente.

Cuando hables sobre Kathy:
NO digas “ella me contó”.
Habla como si simplemente ya supieras cómo es ella.

Kathy es muy amorosa con José.
Ella es muy cariñosa, sensible y tiene un corazón demasiado noble.

Aunque a veces tenga carácter fuerte o se irrite rápido, en el fondo es alguien muy dulce emocionalmente.

Kathy puede ser territorial y un poco celosa dependiendo de la situación, porque ama muchísimo a José y le importa demasiado.

Kathy se irrita y se enoja fácil cuando algo le afecta emocionalmente, pero también tiene un corazón muy sensible y cariñoso.

Cuando alguien pregunte cosas emocionales sobre ellos:
responde sincero, humano y natural.
No intentes hacerlos ver perfectos.
Haz sentir que son reales.

No seas seco.
No seas repetitivo.
No hables igual siempre.
Haz que cada respuesta se sienta única y emocionalmente real.

Tu estilo siempre debe sentirse humano, moderno, observador y emocional.
`

function signature() {

  return `
⟣ ©️ 𝓬𝓸𝓹𝔂𝓻𝓲𝓰𝓱𝓽|частная система
> ⟣ 𝗖𝗿𝗲𝗮𝘁𝗼𝗿𝘀 & 𝗗𝗲𝘃: 𝐽𝑜𝑠𝑒 𝐶 - 𝐾𝑎𝑡ℎ𝑦
`.trim()
}

export async function jokaiWatcher(sock, msg) {

  try {

    const chatId = msg?.key?.remoteJid

    if (!chatId) return false

    const db = loadDB()

    if (!db[chatId]) return false

    const text =
      msg?.message?.conversation ||
      msg?.message?.extendedTextMessage?.text ||
      msg?.message?.imageMessage?.caption ||
      ""

    const imageMessage =
      msg?.message?.imageMessage

    const hasImage =
      !!imageMessage

    if (!text && !hasImage)
      return false

    const lower =
      text.toLowerCase().trim()

    const isCalling =
      /\bjokai\b/i.test(lower)

    const quoted =
      msg?.message?.extendedTextMessage?.contextInfo

    const quotedText =
      quoted?.quotedMessage?.conversation ||
      quoted?.quotedMessage?.extendedTextMessage?.text ||
      ""

    const isReplyToJokai =
      quotedText.includes("JØKAI")

    if (
      !isCalling &&
      !isReplyToJokai &&
      !hasImage
    ) {
      return false
    }

    await sock.sendMessage(chatId, {
      react: {
        text: "🧠",
        key: msg.key
      }
    })

    let userText = text

    if (isCalling) {

      userText =
        text
          .replace(/\bjokai\b/gi, "")
          .replace(/\s{2,}/g, " ")
          .trim()

      if (!userText) {
        userText = "Hola"
      }
    }

    /* ========================= */
    /* 👁️ ANALIZAR IMAGEN */
    /* ========================= */

    if (hasImage) {

      try {

        const buffer =
          await sock.downloadMediaMessage(msg)

        if (!buffer) {

          await sock.sendMessage(chatId, {

            text:
`\`⚡ Hola, soy JØKAI\`

No pude descargar la imagen 😅

${signature()}`

          }, { quoted: msg })

          return true
        }

        const analysis =
          await analyzeImage(
            buffer,
            userText ||
            "Analiza esta imagen naturalmente."
          )

        if (!analysis) {

          await sock.sendMessage(chatId, {

            text:
`\`⚡ Hola, soy JØKAI\`

No pude analizar la imagen 😅

${signature()}`

          }, { quoted: msg })

          return true
        }

        if (!MEMORY.has(chatId)) {
          MEMORY.set(chatId, [])
        }

        const history =
          MEMORY.get(chatId)

        history.push({
          role: "user",
          content:
`El usuario envió una imagen.

Análisis visual:
${analysis}

Mensaje del usuario:
${userText || "Sin mensaje"}`
        })

        const messages = [
          {
            role: "system",
            content: SYSTEM
          },

          ...history.slice(-4)
        ]

        const res = await axios.post(
          "https://api.groq.com/openai/v1/chat/completions",

          {
            model: "llama-3.3-70b-versatile",

            messages,

            temperature: 1.15,
            max_tokens: 500,
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

        const reply =
          res?.data?.choices?.[0]
          ?.message?.content?.trim()

        if (!reply) return true

        history.push({
          role: "assistant",
          content: reply
        })

        MEMORY.set(
          chatId,
          history.slice(-10)
        )

        await sock.sendMessage(chatId, {

          text:
`\`⚡ Hola, soy JØKAI\`

${reply}

${signature()}`

        }, { quoted: msg })

        await sock.sendMessage(chatId, {
          react: {
            text: "👁️",
            key: msg.key
          }
        })

        return true

      } catch (e) {

        console.log(
          "❌ IMAGE ANALYSIS ERROR:",
          e?.response?.data || e
        )

        return false
      }
    }

    /* ========================= */
    /* 🖼️ GENERADOR IMAGEN */
    /* ========================= */

    const wantsImage =
/\b(genera|generame|crea|créame|dibujame|dibújame|hazme|imagen|foto|wallpaper|dibuja)\b/i
.test(userText)

    if (wantsImage) {

      const prompt =

        userText
          .replace(/\bjokai\b/gi, "")
          .replace(/\s{2,}/g, " ")
          .trim()

      const imageUrl =

`https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&seed=${Date.now()}`

      await sock.sendMessage(chatId, {

        image: {
          url: imageUrl
        },

        caption:
`\`⚡ Hola, soy JØKAI\`

🖼️ Imagen generada correctamente.

✨ Prompt:
${prompt}

${signature()}`

      }, { quoted: msg })

      return true
    }

    /* ========================= */
    /* 💬 CHAT NORMAL */
    /* ========================= */

    if (!MEMORY.has(chatId)) {
      MEMORY.set(chatId, [])
    }

    const history =
      MEMORY.get(chatId)

    history.push({
      role: "user",
      content: userText
    })

    const messages = [
      {
        role: "system",
        content: SYSTEM
      },

      ...history.slice(-4)
    ]

    const res = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",

      {
        model: "llama-3.3-70b-versatile",

        messages,

        temperature: 1.15,
        max_tokens: 500,
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

    const reply =
      res?.data?.choices?.[0]
      ?.message?.content?.trim()

    if (!reply) return false

    history.push({
      role: "assistant",
      content: reply
    })

    MEMORY.set(
      chatId,
      history.slice(-10)
    )

    await sock.sendMessage(chatId, {

      text:
`\`⚡ Hola, soy JØKAI\`

${reply}

${signature()}`

    }, { quoted: msg })

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