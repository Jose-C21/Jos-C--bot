// src/bootstrap.js
import fs from "fs"
import path from "path"
import os from "os"
import chalk from "chalk"

const TMP = path.join(process.cwd(), "data", "tmp")
try { fs.mkdirSync(TMP, { recursive: true }) } catch {}

// ✅ Mueve los temporales aquí (Baileys usa os.tmpdir())
process.env.TMPDIR = TMP
process.env.TMP = TMP
process.env.TEMP = TMP

// ─────────────────────────────────────────────
// ✅ LOG PRO (para confirmar que sí aplica TMPDIR)
// ─────────────────────────────────────────────
function bytesToHuman(bytes = 0) {
  const u = ["B", "KB", "MB", "GB", "TB"]
  let i = 0
  let n = Number(bytes) || 0
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++ }
  return `${n.toFixed(2)} ${u[i]}`
}

function logTmpStatus() {
  try {
    const free = os.freemem()
    const total = os.totalmem()
    console.log("")
    console.log(chalk.cyanBright("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"))
    console.log(chalk.cyanBright("◆ BOOTSTRAP / TMPDIR"))
    console.log(chalk.gray("  • ") + chalk.white("process.cwd(): ") + chalk.yellowBright(process.cwd()))
    console.log(chalk.gray("  • ") + chalk.white("TMPDIR: ") + chalk.greenBright(String(process.env.TMPDIR || "")))
    console.log(chalk.gray("  • ") + chalk.white("os.tmpdir(): ") + chalk.greenBright(os.tmpdir()))
    console.log(chalk.gray("  • ") + chalk.white("RAM libre/total: ") + chalk.white(`${bytesToHuman(free)} / ${bytesToHuman(total)}`))

    // listar un poquito de uso del tmp (cuantos archivos)
    let count = 0
    let size = 0
    try {
      for (const f of fs.readdirSync(TMP)) {
        const p = path.join(TMP, f)
        let st
        try { st = fs.statSync(p) } catch { continue }
        if (!st.isFile()) continue
        count++
        size += st.size || 0
      }
    } catch {}
    console.log(chalk.gray("  • ") + chalk.white("tmp files: ") + chalk.white(String(count)) + chalk.gray(" • ") + chalk.white("size: ") + chalk.white(bytesToHuman(size)))
    console.log(chalk.cyanBright("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"))
    console.log("")
  } catch (e) {
    console.log(chalk.redBright("[BOOT] logTmpStatus error:"), e)
  }
}

logTmpStatus()

// ─────────────────────────────────────────────
// ✅ anti-crash (para que no se muera feo)
// ─────────────────────────────────────────────
process.on("uncaughtException", (err) => {
  console.error("[FATAL] uncaughtException:", err)
  if (String(err?.code) === "ENOSPC") {
    console.error("[FATAL] ENOSPC: no space left on device (tmp/cuota llena).")
  }
})

process.on("unhandledRejection", (err) => {
  console.error("[FATAL] unhandledRejection:", err)
})

// ✅ (opcional) limpieza de temporales viejos
function cleanupTmp(maxAgeMs = 10 * 60 * 1000) { // 10 min
  try {
    const now = Date.now()
    for (const f of fs.readdirSync(TMP)) {
      const p = path.join(TMP, f)
      let st
      try { st = fs.statSync(p) } catch { continue }
      if (!st.isFile()) continue
      if (now - st.mtimeMs > maxAgeMs) {
        try { fs.unlinkSync(p) } catch {}
      }
    }
  } catch {}
}
setInterval(() => cleanupTmp(), 60_000).unref?.()

// ✅ Importa tu app real DESPUÉS de setear TMPDIR
await import("./app.js")