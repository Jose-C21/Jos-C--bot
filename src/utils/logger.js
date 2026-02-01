import pino from "pino"

// ✅ Logger silencioso para que no ensucie el prompt
export const logger = pino({
  level: "silent"
})
