import { startSock } from "./adapter/baileys.js"
import { routeMessage } from "./core/router.js"
import { exec } from "child_process"

await startSock(routeMessage)


setInterval(() => {
  exec("git pull", (err, stdout) => {
    if (err) return

    if (
      stdout.includes("Updating") ||
      stdout.includes("changed") ||
      stdout.includes("Fast-forward")
    ) {
      console.log(`
🔄 ACTUALIZACIÓN DESDE GITHUB
${stdout}
🚀 REINICIANDO BOT...
`)
      process.exit(0)
    }
  })
}, 15000)