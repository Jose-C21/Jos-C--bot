import { proto, generateWAMessageFromContent } from "baileys"

export default async function panel(sock, msg) {

const chatId = msg.key.remoteJid

await sock.sendMessage(chatId,{react:{text:"🌴",key:msg.key}})

const message = generateWAMessageFromContent(chatId, proto.Message.fromObject({

viewOnceMessage: {
message: {

interactiveMessage: {

body: {
text: "🌴 PANEL DEL BOT\n\nSelecciona una opción"
},

footer: {
text: "Sistema del Bot"
},

header: {
title: "MENÚ PRINCIPAL",
hasMediaAttachment: false
},

nativeFlowMessage: {
buttons: [

{
name: "quick_reply",
buttonParamsJson: JSON.stringify({
display_text: "🎧 Descargas",
id: ".play"
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
display_text: "⚙️ Config",
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

}), {})

await sock.relayMessage(chatId, message.message, { messageId: message.key.id })

await sock.sendMessage(chatId,{react:{text:"✅",key:msg.key}})

}