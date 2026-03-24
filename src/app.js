import { startSock } from "./adapter/baileys.js"
import { routeMessage } from "./core/router.js"

await startSock(routeMessage)
