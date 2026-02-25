// src/bootstrap.js
import fs from "fs"
import path from "path"

const TMP = path.join(process.cwd(), "data", "tmp")
try { fs.mkdirSync(TMP, { recursive: true }) } catch {}

// ✅ Mueve los temporales aquí (Baileys usa os.tmpdir())
process.env.TMPDIR = TMP
process.env.TMP = TMP
process.env.TEMP = TMP

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