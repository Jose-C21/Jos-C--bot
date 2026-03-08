import { proto } from "baileys"

export default async function panel(sock, msg){

const chat = msg.key.remoteJid

const message = proto.Message.fromObject({

viewOnceMessage:{
message:{
interactiveMessage:{

body:{
text:"🌴 PANEL DEL BOT\n\nSelecciona una opción"
},

footer:{
text:"Sistema del Bot"
},

header:{
title:"MENÚ PRINCIPAL",
hasMediaAttachment:false
},

nativeFlowMessage:{
buttons:[

{
name:"cta_url",
buttonParamsJson:JSON.stringify({
display_text:"🎧 Descargas",
url:"https://wa.me/"
})
},

{
name:"cta_url",
buttonParamsJson:JSON.stringify({
display_text:"🎮 Juegos",
url:"https://wa.me/"
})
},

{
name:"cta_url",
buttonParamsJson:JSON.stringify({
display_text:"⚙️ Config",
url:"https://wa.me/"
})
}

]
}

}
}
}

})

await sock.relayMessage(chat,message,{messageId:msg.key.id})

}