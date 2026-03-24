import { startSock } from "./adapter/baileys.js"
import { exec } from "child_process"

let currentRoute


const loadRouter = async () => {
  const module = await import(`./core/router.js?update=${Date.now()}`)
  currentRoute = module.routeMessage
}


const dynamicRoute = (...args) => {
  return currentRoute(...args)
}


await loadRouter()


await startSock(dynamicRoute)


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
♻️ RECARGANDO ROUTER REAL...
`)

      try {
        await loadRouter()
        console.log("✅ Router actualizado sin reiniciar")
      } catch (e) {
        console.error("❌ Error recargando:", e)
      }
    }
  })
}, 15000)