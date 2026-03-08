import { proto, generateWAMessageContent } from "baileys"

function genId(){
  return "3EB0" + Math.floor(Math.random()*999999999)
}

export default async function panel(sock, msg){

try{

const chat = msg.key.remoteJid

// imagen de la tarjeta
const img = await generateWAMessageContent({
image:{
url:"https://i.postimg.cc/TwGh4vDP/IMG-1651.png"
}
},{upload:sock.waUploadToServer})

const message = proto.Message.fromObject({

viewOnceMessage:{
message:{
interactiveMessage:{

body:{
text:"🌴 PANEL DEL BOT\nSelecciona una opción"
},

footer:{
text:"Sistema del Bot"
},

carouselMessage:{

cards:[

{
header:{
title:"🎧 DESCARGAS",
hasMediaAttachment:true,
imageMessage:img.imageMessage
},

body:{
text:"Descargar música y videos"
},

nativeFlowMessage:{
buttons:[
{
name:"quick_reply",
buttonParamsJson:JSON.stringify({
display_text:"Abrir Descargas",
id:".play"
})
}
]
}
},

{
header:{
title:"🎮 JUEGOS",
hasMediaAttachment:true,
imageMessage:img.imageMessage
},

body:{
text:"Juegos RPG del bot"
},

nativeFlowMessage:{
buttons:[
{
name:"quick_reply",
buttonParamsJson:JSON.stringify({
display_text:"Abrir Juegos",
id:".juegos"
})
}
]
}
},

{
header:{
title:"⚙️ CONFIG",
hasMediaAttachment:true,
imageMessage:img.imageMessage
},

body:{
text:"Configuraciones del bot"
},

nativeFlowMessage:{
buttons:[
{
name:"quick_reply",
buttonParamsJson:JSON.stringify({
display_text:"Abrir Config",
id:".config"
})
}
]
}
}

]

}

}
}
}

})

await sock.relayMessage(chat, message, { messageId: genId() })

}catch(e){
console.log("panel error:",e)
}

}