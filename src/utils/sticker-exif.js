import fs from "fs"
import Crypto from "crypto"
import ff from "fluent-ffmpeg"
import webp from "node-webpmux"
import path from "path"

// ✅ tmp dentro del proyecto (compatible con servidor compartido)
const tempFolder = path.join(process.cwd(), "tmp")

if (!fs.existsSync(tempFolder)) {
  fs.mkdirSync(tempFolder, { recursive: true })
}

function randName(ext) {
  return `${Crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.${ext}`
}

export async function imageToWebp(media) {
  const tmpFileOut = path.join(tempFolder, randName("webp"))
  const tmpFileIn = path.join(tempFolder, randName("jpg"))

  fs.writeFileSync(tmpFileIn, media)

  await new Promise((resolve, reject) => {
    ff(tmpFileIn)
      .on("error", reject)
      .on("end", () => resolve(true))
      .addOutputOptions([
        "-vcodec",
        "libwebp",
        "-vf",
        // ✅ CORREGIDO: min(320,ih) (antes estaba min'(320,ih)')
        "scale='min(320,iw)':'min(320,ih)':force_original_aspect_ratio=decrease,fps=15,pad=320:320:-1:-1:color=white@0.0,split[a][b];[a]palettegen=reserve_transparent=on:transparency_color=ffffff[p];[b][p]paletteuse"
      ])
      .toFormat("webp")
      .save(tmpFileOut)
  })

  const buff = fs.readFileSync(tmpFileOut)
  try { fs.unlinkSync(tmpFileOut) } catch {}
  try { fs.unlinkSync(tmpFileIn) } catch {}
  return buff
}

export async function videoToWebp(media) {
  const tmpFileOut = path.join(tempFolder, randName("webp"))
  const tmpFileIn = path.join(tempFolder, randName("mp4"))

  fs.writeFileSync(tmpFileIn, media)

  await new Promise((resolve, reject) => {
    ff(tmpFileIn)
      .on("error", reject)
      .on("end", () => resolve(true))
      .addOutputOptions([
        "-vcodec",
        "libwebp",
        "-vf",
        // ✅ CORREGIDO: min(320,ih)
        "scale='min(320,iw)':'min(320,ih)':force_original_aspect_ratio=decrease,fps=15,pad=320:320:-1:-1:color=white@0.0,split[a][b];[a]palettegen=reserve_transparent=on:transparency_color=ffffff[p];[b][p]paletteuse",
        "-loop",
        "0",
        "-ss",
        "00:00:00",
        "-t",
        "00:00:05",
        "-preset",
        "default",
        "-an",
        "-vsync",
        "0"
      ])
      .toFormat("webp")
      .save(tmpFileOut)
  })

  const buff = fs.readFileSync(tmpFileOut)
  try { fs.unlinkSync(tmpFileOut) } catch {}
  try { fs.unlinkSync(tmpFileIn) } catch {}
  return buff
}

function buildExif(metadata = {}) {
  const json = {
    "sticker-pack-id": "https://github.com/DikaArdnt/Hisoka-Morou",
    "sticker-pack-name": metadata.packname || "",
    "sticker-pack-publisher": metadata.author || "",
    "emojis": metadata.categories ? metadata.categories : [""]
  }

  const exifAttr = Buffer.from([
    0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00,
    0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x16, 0x00, 0x00, 0x00
  ])

  const jsonBuff = Buffer.from(JSON.stringify(json), "utf-8")
  const exif = Buffer.concat([exifAttr, jsonBuff])
  exif.writeUIntLE(jsonBuff.length, 14, 4)
  return exif
}

export async function writeExifImg(media, metadata) {
  const wMedia = await imageToWebp(media)
  const tmpFileIn = path.join(tempFolder, randName("webp"))
  const tmpFileOut = path.join(tempFolder, randName("webp"))

  fs.writeFileSync(tmpFileIn, wMedia)

  if (metadata?.packname || metadata?.author) {
    const img = new webp.Image()
    const exif = buildExif(metadata)

    await img.load(tmpFileIn)
    try { fs.unlinkSync(tmpFileIn) } catch {}
    img.exif = exif
    await img.save(tmpFileOut)
    return tmpFileOut
  }

  // fallback: sin exif, devolvemos archivo temporal
  fs.writeFileSync(tmpFileOut, wMedia)
  try { fs.unlinkSync(tmpFileIn) } catch {}
  return tmpFileOut
}

export async function writeExifVid(media, metadata) {
  const wMedia = await videoToWebp(media)
  const tmpFileIn = path.join(tempFolder, randName("webp"))
  const tmpFileOut = path.join(tempFolder, randName("webp"))

  fs.writeFileSync(tmpFileIn, wMedia)

  if (metadata?.packname || metadata?.author) {
    const img = new webp.Image()
    const exif = buildExif(metadata)

    await img.load(tmpFileIn)
    try { fs.unlinkSync(tmpFileIn) } catch {}
    img.exif = exif
    await img.save(tmpFileOut)
    return tmpFileOut
  }

  fs.writeFileSync(tmpFileOut, wMedia)
  try { fs.unlinkSync(tmpFileIn) } catch {}
  return tmpFileOut
}

export async function writeExif(media, metadata) {
  let wMedia =
    /webp/.test(media.mimetype) ? media.data :
    /image/.test(media.mimetype) ? await imageToWebp(media.data) :
    /video/.test(media.mimetype) ? await videoToWebp(media.data) : Buffer.alloc(0)

  const tmpFileIn = path.join(tempFolder, randName("webp"))
  const tmpFileOut = path.join(tempFolder, randName("webp"))
  fs.writeFileSync(tmpFileIn, wMedia)

  if (metadata?.packname || metadata?.author) {
    const img = new webp.Image()
    const exif = buildExif(metadata)

    await img.load(tmpFileIn)
    try { fs.unlinkSync(tmpFileIn) } catch {}
    img.exif = exif
    await img.save(tmpFileOut)
    return tmpFileOut
  }

  fs.writeFileSync(tmpFileOut, wMedia)
  try { fs.unlinkSync(tmpFileIn) } catch {}
  return tmpFileOut
}