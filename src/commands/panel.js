// src/commands/panel.js

export default async function panel(sock, msg) {

const chatId = msg?.key?.remoteJid
if (!chatId) return

try {

await sock.sendMessage(chatId, { react: { text: "🌴", key: msg.key } })

const caption =
`╭────〔 🌴 PANEL TEST 〕────╮
│
│ Este es un mensaje de prueba
│ para verificar si el bot
│ detecta correctamente:
│
│ • Video GIF
│ • ContextInfo
│ • Newsletter
│
│ Si ves este mensaje
│ el sistema funciona.
│
╰────────────────────╯`

await sock.sendMessage(chatId, {
video: { url: "https://api.dix.lat/media/1772897846807_-6aXAtErV.mp4" },
caption: caption,
gifPlayback: true,
contextInfo: {
forwardingScore: 1,
isForwarded: true,
forwardedNewsletterMessageInfo: {
newsletterJid: "120363422673025255@newsletter",
newsletterName: "✐ 𝐊𝐢𝐥𝐥𝐮𝐚-𝐖𝐚 𝐂𝐨𝐫𝐞 𝐂𝐡𝐚𝐧𝐧𝐞𝐥 𝐎𝐟𝐢𝐜𝐢𝐚𝐥",
serverMessageId: 100
}
}
}, { quoted: msg })

await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } })

} catch (err) {
console.error("panel test error:", err)
}

}