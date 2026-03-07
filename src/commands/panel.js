// src/commands/panel.js

export default async function panel(sock, msg) {

const chatId = msg?.key?.remoteJid
if (!chatId) return

try {

await sock.sendMessage(chatId,{react:{text:"🌴",key:msg.key}})

await sock.sendMessage(chatId,{
text:
`╭━━〔 🌴 PANEL DEL BOT 〕━━╮
│
│ Bienvenido al sistema
│ interactivo del bot
│
│ Selecciona una opción
│ en el menú de abajo
│
╰━━━━━━━━━━━━━━╯`,

contextInfo:{
externalAdReply:{
title:"Panel del Bot",
body:"Sistema interactivo",
thumbnailUrl:"https://i.postimg.cc/TwGh4vDP/IMG-1651.png",
sourceUrl:"https://whatsapp.com",
mediaType:1,
renderLargerThumbnail:true
}
}

})

await sock.sendMessage(chatId,{
text:"📋 Selecciona una categoría",
footer:"Sistema del Bot",
title:"MENÚ PRINCIPAL",
buttonText:"ABRIR MENÚ",
sections:[

{
title:"DESCARGAS",
rows:[
{
title:"🎧 Descargar música",
description:"Usar comando play",
rowId:".play"
},
{
title:"📥 Descargar TikTok",
description:"Video sin marca",
rowId:".tiktok"
},
{
title:"📘 Descargar Facebook",
description:"Videos de Facebook",
rowId:".facebook"
}
]
},

{
title:"JUEGOS",
rows:[
{
title:"⛏️ Minar",
description:"Ganar coins",
rowId:".minar"
},
{
title:"🎣 Pescar",
description:"Ganar recompensas",
rowId:".pescar"
},
{
title:"🏹 Cazar",
description:"Explorar bosque",
rowId:".cazar"
}
]
},

{
title:"SISTEMA",
rows:[
{
title:"⚙️ Configuración",
description:"Opciones del bot",
rowId:".config"
},
{
title:"👑 Owner",
description:"Contacto del creador",
rowId:".owner"
}
]
}

]

})

await sock.sendMessage(chatId,{react:{text:"✅",key:msg.key}})

}catch(err){
console.error("panel error:",err)
}

}