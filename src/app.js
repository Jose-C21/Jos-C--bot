import { startSock } from "./adapter/baileys.js"
import { exec } from "child_process"

let currentRoute

const loadRouter = async () => {
  const module = await import(`./core/router.js?update=${Date.now()}`)
  currentRoute = module.routeMessage
}

await loadRouter()
await startSock((...args) => currentRoute(...args))

// 🔥 AUTO UPDATE + RECARGA REAL
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
♻️ RECARGANDO ROUTER...
`)

      try {
        await loadRouter()
        console.log("✅ Router recargado correctamente")
      } catch (e) {
        console.error("❌ Error recargando router:", e)
      }
    }
  })
}, 15000)