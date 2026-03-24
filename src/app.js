import { startSock } from "./adapter/baileys.js"
import { routeMessage } from "./core/router.js"
import { exec } from "child_process"

await startSock(routeMessage)


setInterval(() => {
  exec("git pull", async (err, stdout) => {
    if (err) return

    if (
      stdout.includes("Updating") ||
      stdout.includes("changed") ||
      stdout.includes("Fast-forward")
    ) {
      console.log(`
🔄 ACTUALIZACIÓN DESDE GITHUB
${stdout}
♻️ RECARGANDO COMANDOS...
`)

      try {
        if (global.reloadCommands) {
          await global.reloadCommands()
        }
      } catch (e) {
        console.error("❌ Error recargando comandos:", e)
      }
    }
  })
}, 15000)