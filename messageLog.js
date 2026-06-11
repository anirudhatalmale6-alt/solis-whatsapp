const fs = require('fs')
const path = require('path')

const MSG_DIR = process.env.MSG_DIR || path.join(__dirname, 'message_logs')
const STATUS_DIR = path.join(MSG_DIR, 'statuses')
try { fs.mkdirSync(MSG_DIR, { recursive: true }) } catch {}
try { fs.mkdirSync(STATUS_DIR, { recursive: true }) } catch {}

function logMessage(businessId, phone, direction, text, waMessageId, contactName, isLid) {
  try {
    const file = path.join(MSG_DIR, `${businessId}.json`)
    let messages = []
    try { messages = JSON.parse(fs.readFileSync(file, 'utf8')) } catch {}

    const cleanPhone = phone.replace(/@.*/, '')

    const entry = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      waMessageId: waMessageId || null,
      phone: cleanPhone,
      direction,
      text,
      timestamp: new Date().toISOString(),
    }
    if (contactName) entry.contactName = contactName
    if (isLid) entry.isLid = true

    messages.push(entry)
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

// status: 2=sent to server, 3=delivered, 4=read
function updateMessageStatus(businessId, waMessageId, status) {
  try {
    const file = path.join(STATUS_DIR, `${businessId}.json`)
    let statuses = {}
    try { statuses = JSON.parse(fs.readFileSync(file, 'utf8')) } catch {}
    statuses[waMessageId] = { status, updated: new Date().toISOString() }
    const keys = Object.keys(statuses)
    if (keys.length > 5000) {
      const trimmed = {}
      keys.slice(-3000).forEach(k => { trimmed[k] = statuses[k] })
      statuses = trimmed
    }
    fs.writeFileSync(file, JSON.stringify(statuses))
  } catch (err) {
    console.error('Status update error:', err.message)
  }
}

function getMessageStatuses(businessId, waMessageIds) {
  try {
    const file = path.join(STATUS_DIR, `${businessId}.json`)
    const statuses = JSON.parse(fs.readFileSync(file, 'utf8'))
    const result = {}
    for (const id of waMessageIds) {
      result[id] = statuses[id] || null
    }
    return result
  } catch {
    return {}
  }
}

function clearMessages(businessId, phone) {
  try {
    const file = path.join(MSG_DIR, `${businessId}.json`)
    let messages = []
    try { messages = JSON.parse(fs.readFileSync(file, 'utf8')) } catch {}
    if (phone) {
      const cleanPhone = phone.replace('@s.whatsapp.net', '').replace(/\D/g, '')
      messages = messages.filter(m => m.phone.replace(/\D/g, '') !== cleanPhone)
    } else {
      messages = []
    }
    fs.writeFileSync(file, JSON.stringify(messages))
    return true
  } catch (err) {
    console.error('Clear messages error:', err.message)
    return false
  }
}

module.exports = { logMessage, getMessages, updateMessageStatus, getMessageStatuses, clearMessages, MSG_DIR }
