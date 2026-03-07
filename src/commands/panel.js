export default async function panel(sock, msg) {

const chatId = msg?.key?.remoteJid
if (!chatId) return

try {

await sock.sendMessage(chatId, { react: { text: "🌴", key: msg.key } })

await sock.sendMessage(chatId, {
text:
`╭──〔 🌴 PANEL DEL BOT 〕──╮

Selecciona una opción usando
los botones de abajo.

╰──────────────────╯`,

footer: "Sistema del Bot",

buttons: [
{
buttonId: ".play",
buttonText: { displayText: "🎧 Descargas" },
type: 1
},
{
buttonId: ".juegos",
buttonText: { displayText: "🎮 Juegos" },
type: 1
},
{
buttonId: ".config",
buttonText: { displayText: "⚙️ Config" },
type: 1
},
{
buttonId: ".owner",
buttonText: { displayText: "👑 Owner" },
type: 1
}
],

headerType: 1

}, { quoted: msg })

await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } })

} catch (err) {
console.error("panel error:", err)
}

}