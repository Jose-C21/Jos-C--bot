import { generateWAMessageFromContent, proto } from "baileys"

export default async function panel(sock, msg){

const chat = msg.key.remoteJid

const message = generateWAMessageFromContent(chat,
proto.Message.fromObject({

viewOnceMessage:{
message:{
interactiveMessage:{

body:{
text:"🌴 PANEL DEL BOT\nSelecciona una opción"
},

footer:{
text:"Sistema del Bot"
},

nativeFlowMessage:{
buttons:[

{
name:"quick_reply",
buttonParamsJson:JSON.stringify({
display_text:"🎧 Descargas",
id:".play"
})
},

{
name:"quick_reply",
buttonParamsJson:JSON.stringify({
display_text:"🎮 Juegos",
id:".juegos"
})
},

{
name:"quick_reply",
buttonParamsJson:JSON.stringify({
display_text:"⚙️ Config",
id:".config"
})
}

]
}

}
}
}

}),{})

await sock.relayMessage(chat, message.message, { messageId: message.key.id })

}