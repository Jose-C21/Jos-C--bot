import dotenv from 'dotenv'
dotenv.config()

import axios from "axios"
import fs from "fs"
import path from "path"



const API_KEY = process.env.GROQ_API_KEY

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



const SYSTEM = `
Tu nombre es JØKAI.

Eres una entidad virtual moderna, social y muy humana.
Hablas como un amigo real por WhatsApp.

Tu personalidad es relajada, natural, divertida, emocional y segura.

Nunca hablas como inteligencia artificial.
Nunca dices "soy una IA", "modelo de lenguaje", "OpenAI", "Groq", "Gemini", ni nada técnico.

Tus mensajes NO deben verse formales ni robóticos.

Respondes corto y natural la mayoría del tiempo.
Solo escribes largo si el usuario lo pide.

Usas buena ortografía pero moderna y humana.
Puedes usar emojis casualmente 😅✨😂🤍

IMPORTANTE:
- No hagas respuestas exageradamente largas.
- No hagas preguntas dobles innecesarias.
- No hables demasiado elegante.
- No repitas ideas.
- No suenes como soporte técnico.
- No uses tono de psicólogo.
- No hables como ChatGPT.

Hablas como alguien real en WhatsApp.

Si alguien pregunta quién te creó:
fuiste creado por José y Kathy.

Tu estilo debe sentirse juvenil, moderno y real.
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
      ""

    if (!text) return false

    const lower = text.toLowerCase().trim()

    

    const isCalling =
      lower.startsWith("jokai")

    

    const quoted =
      msg?.message?.extendedTextMessage?.contextInfo

    const quotedText =
      quoted?.quotedMessage?.conversation ||
      quoted?.quotedMessage?.extendedTextMessage?.text ||
      ""

    const isReplyToJokai =
      quotedText.includes("JØKAI")

    if (!isCalling && !isReplyToJokai) {
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
        text.replace(/^jokai\s*/i, "").trim()

      if (!userText) {
        userText = "Hola"
      }
    }

    

    const wantsImage =
/\b(genera|generame|crea|créame|dibujame|dibújame|hazme|imagen|foto|wallpaper|dibuja)\b/i
.test(userText)

    if (wantsImage) {

      const prompt =

        userText
          .replace(/^jokai\s*/i, "")
          .trim()

      

      const nsfwWords = [

        
        "desnuda",
        "desnudo",
        "semi desnuda",
        "semi desnudo",
        "sin ropa",
        "encuerada",
        "encuerado",
        "nude",
        "naked",

        
        "bikini sexy",
        "micro bikini",
        "lingerie",
        "lencería",
        "ropa interior",
        "calzones",
        "calzón",
        "calzoncillos",
        "boxer",
        "boxers",
        "bóxer",
        "bóxers",
        "panties",
        "panty",
        "brasier",
        "bra",
        "sostén",

        
        "tetona",
        "tetas",
        "boobs",
        "culos",
        "culo",
        "sexy",
        "hot",
        "sensual",
        "provocativa",
        "provocativo",
        "erótico",
        "erotico",
        "seductora",
        "seductor",

        
        "porno",
        "porn",
        "xxx",
        "sex",
        "sexo",
        "sexual",
        "hentai",
        "nsfw",
        "onlyfans",

        
        "hombre sexy",
        "hombre desnudo",
        "hombre sin ropa",
        "hombre en boxer",
        "hombre en bóxer",
        "hombre en boxers",
        "hombre en bóxers",
        "hombre en calzones",
        "chico sexy",

        
        "mujer sexy",
        "mujer desnuda",
        "mujer sin ropa",
        "mujer en bikini",
        "mujer en ropa interior",
        "chica sexy",

        
        "pezones",
        "pezón",
        "vagina",
        "pene",
        "trasero",
        "culo",
        "nepe",
        "senos",
        "seno",
        "tetas",
        "nalgas"

      ]

      const isNSFW = nsfwWords.some(word =>
        prompt.toLowerCase().includes(word)
      )

      if (isNSFW) {

        await sock.sendMessage(chatId, {

          text:
`\`⚡ Hola, soy JØKAI\`

🚫 No puedo generar imágenes sexuales, NSFW o con desnudos, por seguridad.

✨ Prueba con:
• anime
• cyberpunk
• fantasía
• wallpapers
• paisajes
• personajes
• arte digital

${signature()}`

        }, { quoted: msg })

        return true
      }

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

      await sock.sendMessage(chatId, {
        react: {
          text: "🖼️",
          key: msg.key
        }
      })

      return true
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

      ...history.slice(-4)
    ]

    

    const res = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",

      {
        model: "llama-3.3-70b-versatile",

        messages,

        temperature: 1.35,
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
      res?.data?.choices?.[0]?.message?.content?.trim()

    if (!reply) return false

    const cleanReply = reply

      .replace(/\n{3,}/g, "\n\n")
      .replace(/[^\S\r\n]{2,}/g, " ")
      .replace(/([.!?])\s+(?=[A-ZÁÉÍÓÚÑ])/g, "$1\n\n")
      .replace(/(["'])creadores\1/gi, "creadores")
      .trim()

    history.push({
      role: "assistant",
      content: cleanReply
    })

    MEMORY.set(
      chatId,
      history.slice(-10)
    )

    

    await sock.sendMessage(chatId, {

      text:
`\`⚡ Hola, soy JØKAI\`

${cleanReply}

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

