await sock.sendMessage(chatId, {
text: "🌴 PANEL DEL BOT\nSelecciona una opción",
footer: "Sistema del Bot",
title: "Menú",
buttonText: "Abrir menú",
sections: [
{
title: "Opciones",
rows: [
{
title: "🎧 Descargas",
rowId: ".play"
},
{
title: "🎮 Juegos",
rowId: ".juegos"
},
{
title: "⚙️ Configuración",
rowId: ".config"
}
]
}
]
})