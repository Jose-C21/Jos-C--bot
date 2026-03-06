import fs from "fs"
import path from "path"

const DATA_DIR = path.join(process.cwd(), "data")
const RPG_PATH = path.join(DATA_DIR, "rpg.json")
const DAILY_PATH = path.join(DATA_DIR, "rpgDaily.json")

const LIMIT_COINS = 1200
const LIMIT_XP = 300
const LIMIT_GEMS = 3

function ensureDB() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })

  if (!fs.existsSync(RPG_PATH)) {
    fs.writeFileSync(RPG_PATH, JSON.stringify({}, null, 2))
  }

  if (!fs.existsSync(DAILY_PATH)) {
    fs.writeFileSync(DAILY_PATH, JSON.stringify({}, null, 2))
  }
}

function readRPG() {
  ensureDB()
  return JSON.parse(fs.readFileSync(RPG_PATH))
}

function writeRPG(db) {
  ensureDB()
  fs.writeFileSync(RPG_PATH, JSON.stringify(db, null, 2))
}

function readDaily() {
  ensureDB()
  return JSON.parse(fs.readFileSync(DAILY_PATH))
}

function writeDaily(db) {
  ensureDB()
  fs.writeFileSync(DAILY_PATH, JSON.stringify(db, null, 2))
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

export function getUserRPG(chatId, userId) {
  const db = readRPG()

  if (!db[chatId]) db[chatId] = {}

  if (!db[chatId][userId]) {
    db[chatId][userId] = {
      xp: 0,
      level: 1,
      coins: 0,
      gems: 0
    }
  }

  writeRPG(db)
  return db[chatId][userId]
}

export function saveUserRPG(chatId, userId, data) {
  const db = readRPG()

  if (!db[chatId]) db[chatId] = {}

  db[chatId][userId] = data

  writeRPG(db)
}

export function getDaily(chatId, userId) {
  const db = readDaily()

  if (!db[chatId]) db[chatId] = {}

  if (!db[chatId][userId]) {
    db[chatId][userId] = {
      coins: 0,
      xp: 0,
      gems: 0,
      date: today()
    }
  }

  if (db[chatId][userId].date !== today()) {
    db[chatId][userId] = {
      coins: 0,
      xp: 0,
      gems: 0,
      date: today()
    }
  }

  writeDaily(db)
  return db[chatId][userId]
}

export function addCoins(chatId, userId, amount) {
  const user = getUserRPG(chatId, userId)
  const daily = getDaily(chatId, userId)

  const faltan = LIMIT_COINS - daily.coins
  const add = Math.max(0, Math.min(amount, faltan))

  user.coins += add
  daily.coins += add

  saveUserRPG(chatId, userId, user)

  const db = readDaily()
  db[chatId][userId] = daily
  writeDaily(db)

  return add
}

export function addXP(chatId, userId, amount) {
  const user = getUserRPG(chatId, userId)
  const daily = getDaily(chatId, userId)

  const faltan = LIMIT_XP - daily.xp
  const add = Math.max(0, Math.min(amount, faltan))

  user.xp += add
  daily.xp += add

  const nextLevelXP = user.level * 150

  if (user.xp >= nextLevelXP) {
    user.level += 1
    user.xp = 0
  }

  saveUserRPG(chatId, userId, user)

  const db = readDaily()
  db[chatId][userId] = daily
  writeDaily(db)

  return add
}

export function addGems(chatId, userId, amount) {
  const user = getUserRPG(chatId, userId)
  const daily = getDaily(chatId, userId)

  const faltan = LIMIT_GEMS - daily.gems
  const add = Math.max(0, Math.min(amount, faltan))

  user.gems += add
  daily.gems += add

  saveUserRPG(chatId, userId, user)

  const db = readDaily()
  db[chatId][userId] = daily
  writeDaily(db)

  return add
}