import edgeTTS from "node-edge-tts"
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
  /* 🎙️ GENERAR VOZ */
  /* ========================= */

  await edgeTTS.ttsPromise({
    text,
    voice: "es-MX-DaliaNeural",
    rate: "+0%",
    pitch: "+0Hz",
    volume: "+0%"
  })
  .then(async (stream) => {

    const chunks = []

    for await (const chunk of stream) {
      chunks.push(chunk)
    }

    fs.writeFileSync(
      mp3Path,
      Buffer.concat(chunks)
    )
  })

  /* ========================= */
  /* 🔊 CONVERTIR A OPUS */
  /* ========================= */

  await new Promise((resolve, reject) => {

    ffmpeg(mp3Path)

      .audioCodec("libopus")

      .audioBitrate(128)

      .format("ogg")

      .save(opusPath)

      .on("end", resolve)

      .on("error", reject)
  })

  /* ========================= */
  /* 📦 BUFFER FINAL */
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