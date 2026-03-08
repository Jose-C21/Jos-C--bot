import { generateWAMessageContent, generateWAMessageFromContent, proto } from "baileys"

function generateMessageIDV2(id = "") {
return "3EB0" + Math.floor(Math.random() * 999999999)
}

export default async function panel(sock, msg){

const chat = msg.key.remoteJid

const id = generateMessageIDV2(sock.user?.id)

const image = await generateWAMessageContent({
image:{
url:"https://i.pinimg.com/736x/d4/8c/79/d48c79039d6f7b127f1a2eee4c78290c.jpg"
}
},{upload:sock.waUploadToServer})

const message = {
interactiveMessage:{
header:{
title:"🌴 PANEL DEL BOT",
hasMediaAttachment:true,

productMessage:{
product:{
productImage:image.imageMessage,
productId:"9999",
title:"Panel del Bot",
description:"Sistema interactivo",
retailerId:"panel",
url:`https://wa.me/${sock.user.id.split(":")[0]}`,
productImageCount:1
},
businessOwnerJid:sock.user.id
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

await sock.relayMessage(chat,{
viewOnceMessage:{
message:message
}
},{
messageId:id
})

}