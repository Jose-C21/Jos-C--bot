// src/commands/clima.js
import axios from "axios"

// ========================= //
// ✨ FIRMA                  //
// ========================= //

const SIGNATURE =
`\n\n⟣ ©️ 𝓬𝓸𝓹𝔂𝓻𝓲𝓰𝓱𝓽|𝘑𝘊𝘒𝘡𝘐𝘯𝘧𝘪𝘯𝘪𝘵𝘺𝘓𝘰𝘰𝘱\n> ⟣ 𝗖𝗿𝗲𝗮𝘁𝗼𝗿𝘀 & 𝗗𝗲𝘃: 𝐽𝑜𝑠𝑒 𝐶 - 𝐾𝑎𝘁ℎ𝑦 𝑍`

// ========================= //
// 🌡️ UTILIDADES             //
// ========================= //

// Emojis por código WMO de clima
function emojiClima(code, esNoche = false) {
  if (code === 0)              return esNoche ? "🌙" : "☀️"
  if (code <= 2)               return esNoche ? "🌤️" : "🌤️"
  if (code === 3)              return "☁️"
  if (code <= 49)              return "🌫️"
  if (code <= 59)              return "🌦️"
  if (code <= 69)              return "🌧️"
  if (code <= 79)              return "🌨️"
  if (code <= 82)              return "🌧️"
  if (code <= 86)              return "❄️"
  if (code <= 99)              return "⛈️"
  return "🌈"
}

// Descripción en español por código WMO
function descripcionClima(code) {
  if (code === 0)   return "Despejado"
  if (code === 1)   return "Mayormente despejado"
  if (code === 2)   return "Parcialmente nublado"
  if (code === 3)   return "Nublado"
  if (code <= 49)   return "Neblina / Niebla"
  if (code <= 59)   return "Llovizna"
  if (code <= 69)   return "Lluvia"
  if (code <= 79)   return "Nieve"
  if (code === 80)  return "Lluvia ligera"
  if (code === 81)  return "Lluvia moderada"
  if (code === 82)  return "Lluvia intensa"
  if (code <= 86)   return "Nevada"
  if (code <= 99)   return "Tormenta eléctrica"
  return "Desconocido"
}

// Emoji de dirección del viento
function emojiViento(grados) {
  const dirs = ["⬆️ N","↗️ NE","➡️ E","↘️ SE","⬇️ S","↙️ SO","⬅️ O","↖️ NO"]
  return dirs[Math.round(grados / 45) % 8]
}

// Emoji de UV
function emojiUV(uv) {
  if (uv <= 2)  return "🟢 Bajo"
  if (uv <= 5)  return "🟡 Moderado"
  if (uv <= 7)  return "🟠 Alto"
  if (uv <= 10) return "🔴 Muy alto"
  return "🟣 Extremo"
}

// Emoji de humedad
function emojiHumedad(h) {
  if (h < 30) return "🏜️"
  if (h < 60) return "💧"
  return "💦"
}

// Barra visual de humedad (10 bloques)
function barraHumedad(valor, max = 100) {
  const filled = Math.round((valor / max) * 10)
  return "█".repeat(filled) + "░".repeat(10 - filled)
}

// ========================= //
// 🌡️ FAHRENHEIT             //
// ========================= //

// Países que usan Fahrenheit (códigos ISO 3166-1 alpha-2)
const PAISES_FAHRENHEIT = new Set([
  "US",  // Estados Unidos
  "KY",  // Islas Caimán
  "PR",  // Puerto Rico
  "VI",  // Islas Vírgenes de EE.UU.
  "GU",  // Guam
  "AS",  // Samoa Americana
  "MP",  // Islas Marianas del Norte
  "MH",  // Islas Marshall
  "FM",  // Micronesia
  "PW",  // Palaos
  "BS",  // Bahamas
  "BZ",  // Belice
])

// Convierte Celsius a Fahrenheit
function cToF(c) {
  return Math.round((c * 9 / 5) + 32)
}

// Detecta si un país usa Fahrenheit a partir del código o nombre del país
function usaFahrenheit(countryCode = "") {
  return PAISES_FAHRENHEIT.has(String(countryCode).toUpperCase())
}

// Emoji de temperatura (acepta °F o °C con flag)
function emojiTempUniversal(t, esFahrenheit = false) {
  // Normaliza a Celsius para comparar
  const c = esFahrenheit ? (t - 32) * 5 / 9 : t
  if (c <= 0)  return "🥶"
  if (c <= 15) return "🧥"
  if (c <= 24) return "😊"
  if (c <= 32) return "😎"
  return "🔥"
}

// ========================= //
// 🌐 APIs                   //
// ========================= //

// 1) Geocodificación: ciudad → coordenadas (Open-Meteo Geocoding, gratis)
async function geocodificar(ciudad) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(ciudad)}&count=1&language=es&format=json`
  const { data } = await axios.get(url, { timeout: 10000 })
  const result = data?.results?.[0]
  if (!result) return null
  return {
    nombre:      result.name,
    pais:        result.country || "",
    codigoPais:  result.country_code || "",
    region:      result.admin1 || "",
    lat:         result.latitude,
    lon:         result.longitude,
    timezone:    result.timezone || "UTC"
  }
}

// 2) Clima actual: coordenadas → datos (Open-Meteo, gratis, sin API key)
async function obtenerClima(lat, lon, timezone, tempUnit = "celsius") {
  const params = [
    `latitude=${lat}`,
    `longitude=${lon}`,
    `timezone=${encodeURIComponent(timezone)}`,
    "current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,uv_index,precipitation,surface_pressure,cloud_cover,is_day",
    "daily=temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max",
    "forecast_days=1",
    "wind_speed_unit=kmh",
    `temperature_unit=${tempUnit}`
  ].join("&")

  const url = `https://api.open-meteo.com/v1/forecast?${params}`
  const { data } = await axios.get(url, { timeout: 10000 })
  return data
}

// ========================= //
// 🚀 COMANDO PRINCIPAL      //
// ========================= //

export default async function clima(sock, msg, { args = [], usedPrefix = "." }) {
  const chatId = msg?.key?.remoteJid
  if (!chatId) return

  // ─── Sin argumentos ───
  const ciudad = args.join(" ").trim()
  if (!ciudad) {
    return await sock.sendMessage(chatId, {
      text:
`🌍 *Uso del comando clima:*

*${usedPrefix}clima* <ciudad>

📌 Ejemplos:
• ${usedPrefix}clima Tegucigalpa
• ${usedPrefix}clima Ciudad de México
• ${usedPrefix}clima Miami${SIGNATURE}`
    }, { quoted: msg })
  }

  // ─── Reacción de carga ───
  try { await sock.sendMessage(chatId, { react: { text: "🌍", key: msg.key } }) } catch {}

  try {
    // 1. Geocodificar ciudad
    const lugar = await geocodificar(ciudad)

    if (!lugar) {
      try { await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } }) } catch {}
      return await sock.sendMessage(chatId, {
        text: `❌ No se encontró la ciudad *"${ciudad}"*.\n\nVerifica el nombre e inténtalo de nuevo.${SIGNATURE}`
      }, { quoted: msg })
    }

    // 2. Obtener clima
    const esFahrenheit = usaFahrenheit(lugar.codigoPais)
    const tempUnit     = esFahrenheit ? "fahrenheit" : "celsius"
    const simbolo      = esFahrenheit ? "°F" : "°C"

    const data = await obtenerClima(lugar.lat, lugar.lon, lugar.timezone, tempUnit)
    const c = data.current
    const d = data.daily

    // ─── Valores actuales ───
    const temp       = Math.round(c.temperature_2m)
    const sensacion  = Math.round(c.apparent_temperature)
    const humedad    = Math.round(c.relative_humidity_2m)
    const viento     = Math.round(c.wind_speed_10m)
    const dirViento  = Math.round(c.wind_direction_10m)
    const uv         = Math.round(c.uv_index ?? 0)
    const presion    = Math.round(c.surface_pressure)
    const nubes      = Math.round(c.cloud_cover)
    const lluvia     = Number(c.precipitation ?? 0).toFixed(1)
    const code       = c.weather_code
    const esNoche    = c.is_day === 0

    // ─── Min/Max del día ───
    const tempMax    = Math.round(d.temperature_2m_max?.[0] ?? temp)
    const tempMin    = Math.round(d.temperature_2m_min?.[0] ?? temp)
    const probLluvia = Math.round(d.precipitation_probability_max?.[0] ?? 0)

    // ─── Amanecer / Atardecer ───
    const amanecer   = (d.sunrise?.[0]  || "").split("T")[1]?.slice(0,5) || "--:--"
    const atardecer  = (d.sunset?.[0]   || "").split("T")[1]?.slice(0,5) || "--:--"

    // ─── Emojis ───
    const eClima    = emojiClima(code, esNoche)
    const eTemp     = emojiTempUniversal(temp, esFahrenheit)
    const eHumedad  = emojiHumedad(humedad)
    const eUV       = emojiUV(uv)
    const eViento   = emojiViento(dirViento)
    const bHumedad  = barraHumedad(humedad)
    const descClima = descripcionClima(code)

    // ─── Ubicación formateada ───
    const ubicacion = [lugar.nombre, lugar.region, lugar.pais]
      .filter(Boolean)
      .join(", ")

    // ─── Hora local ───
    const horaLocal = new Date().toLocaleTimeString("es", {
      timeZone: lugar.timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    })

    // ─── Mensaje final ───
    const texto =
`${eClima} *CLIMA EN ${ubicacion.toUpperCase()}*
┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄

${eTemp} *Temperatura:* ${temp}${simbolo}
🌡️ *Sensación:* ${sensacion}${simbolo}
📉 *Mín / Máx:* ${tempMin}${simbolo} — ${tempMax}${simbolo}

🌥️ *Condición:* ${descClima}
${eHumedad} *Humedad:* ${humedad}%
\`${bHumedad}\`

💨 *Viento:* ${viento} km/h  ${eViento}
⛅ *Nubosidad:* ${nubes}%
🌧️ *Prob. lluvia:* ${probLluvia}%
🌊 *Precipitación:* ${lluvia} mm

🔆 *Índice UV:* ${eUV}
🧭 *Presión:* ${presion} hPa

🌅 *Amanecer:* ${amanecer}
🌇 *Atardecer:* ${atardecer}
🕐 *Hora local:* ${horaLocal}${SIGNATURE}`

    await sock.sendMessage(chatId, { text: texto }, { quoted: msg })
    try { await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } }) } catch {}

  } catch (e) {
    console.error("[clima] ERROR:", e)
    try { await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } }) } catch {}
    await sock.sendMessage(chatId, {
      text: `❌ Error al obtener el clima. Inténtalo de nuevo.\n\n${e?.message || ""}${SIGNATURE}`
    }, { quoted: msg })
  }
}
