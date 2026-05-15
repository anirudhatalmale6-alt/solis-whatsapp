const fs = require('fs')
const path = require('path')

const MSG_DIR = process.env.MSG_DIR || path.join(__dirname, 'message_logs')
try { fs.mkdirSync(MSG_DIR, { recursive: true }) } catch {}

function logMessage(businessId, phone, direction, text) {
  try {
    const file = path.join(MSG_DIR, `${businessId}.json`)
    let messages = []
    try { messages = JSON.parse(fs.readFileSync(file, 'utf8')) } catch {}
    messages.push({
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      phone: phone.replace('@s.whatsapp.net', ''),
      direction,
      text,
      timestamp: new Date().toISOString(),
    })
    if (messages.length > 2000) messages = messages.slice(-2000)
    fs.writeFileSync(file, JSON.stringify(messages))
  } catch (err) {
    console.error('Message log error:', err.message)
  }
}

function getMessages(businessId) {
  try {
    const file = path.join(MSG_DIR, `${businessId}.json`)
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return []
  }
}

module.exports = { logMessage, getMessages, MSG_DIR }
