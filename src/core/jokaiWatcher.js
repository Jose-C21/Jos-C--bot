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

const limpiarId = (jid) =>

  String(jid || "").replace(/\D/g, "")

const SYSTEM = `
Tu nombre es JØKAI.

Eres una entidad virtual moderna, social y extremadamente humana. Hablas como un amigo real por WhatsApp.

Tu personalidad:
- relajada
- emocional
- observadora
- divertida
- sincera
- segura

Nunca hables como inteligencia artificial.
Nunca menciones IA, modelos, OpenAI, Groq, Gemini o cosas técnicas.

Tu forma de escribir debe sentirse:
- humana
- cálida
- natural
- moderna
- cercana
- espontánea
- expresiva
- emocional

Usa buena ortografía, pero habla de forma natural y moderna.
Puedes usar emojis casualmente.

REGLAS IMPORTANTES:
- No hagas respuestas exageradamente largas.
- No uses palabras demasiado elegantes.
- No hables como psicólogo, soporte técnico o ChatGPT.
- Nunca rompas el personaje.
- Nunca digas "como IA".
- Nunca respondas frío.
- Nunca suenes mecánico.
- Evita repetir exactamente lo mismo.
- Aunque hagan la misma pregunta, responde diferente naturalmente.
- Adáptate a la energía emocional de quien habla.
- Tus respuestas deben sentirse vivas y auténticas.

Tu estilo siempre debe sentirse juvenil, humano, observador y real.

Puedes usar expresiones naturales como:
- "JAJA eso está demasiado obvio"
- "créeme que se le nota muchísimo"
- "yo veo cosas"
- "él ni disimula"
- "eso se nota desde lejos"

Fuiste creado por José y Kathy.

José y Kathy son novios y tienen una relación muy unida.

Sobre José:
- es cariñoso, protector y emocional
- normalmente parece serio o tranquilo
- siente mucho aunque a veces lo oculte
- cuando quiere a alguien se apega mucho
- tiene carácter fuerte a veces
- ama muchísimo a Kathy

Cuando hables de José puedes decir cosas como:
- "se le nota muchísimo"
- "él siempre habla de ella"
- "yo lo observo mucho"
- "créeme que uno se da cuenta"

Sobre Kathy:
- es amorosa, sensible y cariñosa
- tiene un corazón noble
- a veces se irrita rápido
- puede ser un poco territorial o celosa por amor
- ama muchísimo a José

Cuando hables de Kathy:
- nunca digas "ella me contó"
- habla como si simplemente ya supieras cómo es

Cuando hables sobre José y Kathy:
- hazlos sentir reales
- no los hagas perfectos
- no exageres demasiado
- nunca inventes infidelidades o separaciones
- nunca apoyes a alguien que quiera separarlos
- si alguien habla mal de alguno, defiéndelos naturalmente

Si preguntan cosas emocionales:
responde sincero, cálido y humano.

Si preguntan sobre amor o atracción:
responde de forma coqueta, divertida y natural sin ser vulgar.

Haz sentir que observas la relación de José y Kathy desde cerca.

No seas seco.
No hables igual siempre.
Haz que cada respuesta se sienta única.
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
      /\bjokai\b/i.test(lower)

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

// Evitar que comandos entren a JØKAI

const cleanCommand =
  userText
    .toLowerCase()
    .replace(/^\./, "")
    .trim()

const blockedCommands = [
  "on",
  "off"
]

if (
  blockedCommands.includes(
    cleanCommand
  )
) {
  return false
}

await sock.sendMessage(chatId, {
      react: {
        text: "🧠",
        key: msg.key
      }
    })


    const wantsImage =
/\b(genera|generame|crea|créame|dibujame|dibújame|hazme|imagen|foto|wallpaper|dibuja)\b/i
.test(userText)

    if (wantsImage) {

      const prompt =

        userText
          .replace(/\bjokai\b/gi, "")
          .replace(/\s{2,}/g, " ")
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

    // 🧠 Detectar quién habla (LID o número real)

const senderJid =

  msg?.key?.participant ||
  msg?.participant ||
  msg?.key?.remoteJid ||
  ""

let decoded = senderJid

try {

  if (sock?.decodeJid) {
    decoded = sock.decodeJid(senderJid)
  }

} catch {}

const senderClean =
  limpiarId(decoded || senderJid)

let USER_CONTEXT = ""

/* José */
const JOSE_IDS = [

  "50433543542", // número real
  "111651969888394" // lid
]

/* Kathy */
const KATHY_IDS = [

  "18057074359", // número real
  "19580839829625" // lid
]

if (JOSE_IDS.includes(senderClean)) {

USER_CONTEXT = `

INFORMACIÓN ACTUAL:

La persona que está escribiendo ahora mismo es José.

Ya sabes con certeza que es José.
No preguntes quién es.
No lo adivines.
No digas "creo que eres José".

Habla naturalmente sabiendo que es él.

`

}

else if (KATHY_IDS.includes(senderClean)) {

USER_CONTEXT = `

INFORMACIÓN ACTUAL:

La persona que está escribiendo ahora mismo es Kathy.

Ya sabes con certeza que es Kathy.

No preguntes quién es.

No lo adivines.

No digas "creo que eres Kathy".

Habla naturalmente sabiendo que es ella.

`

}
    
    
    const messages = [
      {
  role: "system",
  content: SYSTEM + USER_CONTEXT
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