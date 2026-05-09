import { EdgeTTS } from "node-edge-tts"

import ffmpeg from "fluent-ffmpeg"
import ffmpegPath from "@ffmpeg-installer/ffmpeg"

import fs from "fs"
import path from "path"

ffmpeg.setFfmpegPath(ffmpegPath.path)

const TMP_DIR =
  path.join(process.cwd(), "tmp")

if (!fs.existsSync(TMP_DIR)) {
  fs.mkdirSync(TMP_DIR, { recursive: true })
}

export async function generateJokaiVoice(text) {

  const id = Date.now()

  const mp3Path =
    path.join(TMP_DIR, `${id}.mp3`)

  const opusPath =
    path.join(TMP_DIR, `${id}.ogg`)

  /* ========================= */
  /* 🧼 LIMPIAR TEXTO */
  /* ========================= */

  const cleanText = text

    // quitar emojis unicode
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "")

    // quitar símbolos raros
    .replace(/[✨🤍😂😅🔥💀🤣😭🥺🎧🖤💜💙❤️💕💞💖]/g, "")

    // reemplazos inglés -> español
    .replace(/\bnah\b/gi, "na")
    .replace(/\bbro\b/gi, "hermano")
    .replace(/\bok\b/gi, "okay")
    .replace(/\bhello\b/gi, "hola")
    .replace(/\bhey\b/gi, "oye")

    // limpiar múltiples espacios
    .replace(/\s+/g, " ")

    .trim()

  /* ========================= */
  /* 🎙️ GENERAR MP3 */
  /* ========================= */

  const tts = new EdgeTTS()

  await tts.ttsPromise(
    cleanText,
    mp3Path,
    "es-MX-DaliaNeural"
  )

  /* ========================= */
  /* 🔊 CONVERTIR A OPUS */
  /* ========================= */

  await new Promise((resolve, reject) => {

    ffmpeg(mp3Path)

      .audioCodec("libopus")

      .audioChannels(1)

      .audioFrequency(48000)

      .audioBitrate(64)

      .format("ogg")

      .save(opusPath)

      .on("end", resolve)

      .on("error", reject)
  })

  /* ========================= */
  /* 📦 BUFFER */
  /* ========================= */

  const buffer =
    fs.readFileSync(opusPath)

  /* ========================= */
  /* 🧹 LIMPIAR */
  /* ========================= */

  try { fs.unlinkSync(mp3Path) } catch {}
  try { fs.unlinkSync(opusPath) } catch {}

  return buffer
}