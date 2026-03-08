import { generateWAMessageContent, generateWAMessageFromContent, proto } from "baileys"

export default async function panel(sock, msg){

const chat = msg.key.remoteJid

// imagen del producto
const image = await generateWAMessageContent({
image:{
url:"https://i.postimg.cc/TwGh4vDP/IMG-1651.png"
}
},{upload:sock.waUploadToServer})

const message = generateWAMessageFromContent(chat,

proto.Message.fromObject({

viewOnceMessage:{
message:{
interactiveMessage:{

header:{
title:"🌴 PANEL DEL BOT",
hasMediaAttachment:true,

productMessage:{
product:{
productImage:image.imageMessage,
productId:"26269801872707544",
title:"Panel del Bot",
description:"Sistema interactivo",
retailerId:"panel-bot",
url:"https://wa.me/p/26269801872707544/50433307811",
productImageCount:1
},
businessOwnerJid:"50433307811@s.whatsapp.net"
}

},

body:{
text:"Selecciona una opción"
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

})

,{}) 

await sock.relayMessage(chat,message.message,{messageId:message.key.id})

}