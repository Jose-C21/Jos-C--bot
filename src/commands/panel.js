// src/commands/panel.js

export default async function panel(sock, msg) {

const chatId = msg?.key?.remoteJid
if (!chatId) return

try {

await sock.sendMessage(chatId, { react: { text: "🌴", key: msg.key } })

await sock.sendMessage(chatId, {

viewOnceMessage: {
message: {
interactiveMessage: {

body: {
text:
`╭──〔 🌴 PANEL DEL BOT 〕──╮
│
│ Bienvenido al sistema
│ interactivo del bot
│
│ Selecciona una opción
│ usando los botones
│
╰──────────────────╯`
},

footer: {
text: "© Jose C - Kathy"
},

header: {
title: "Sistema del Bot",
hasMediaAttachment: false
},

nativeFlowMessage: {
buttons: [

{
name: "quick_reply",
buttonParamsJson: JSON.stringify({
display_text: "📥 Descargas",
id: ".descargas"
})
},

{
name: "quick_reply",
buttonParamsJson: JSON.stringify({
display_text: "🎮 Juegos",
id: ".juegos"
})
},

{
name: "quick_reply",
buttonParamsJson: JSON.stringify({
display_text: "⚙️ Configuración",
id: ".config"
})
},

{
name: "quick_reply",
buttonParamsJson: JSON.stringify({
display_text: "👑 Owner",
id: ".owner"
})
}

]

}

}

}

}

})

await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } })

} catch (err) {
console.error("panel error:", err)
}

}