const express = require('express')
const cors = require('cors')
const { SessionManager } = require('./sessions')
const { handleIncomingMessage } = require('./handler')
const { logMessage, getMessages, getMessageStatuses, clearMessages } = require('./messageLog')

process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught exception (keeping alive):', err.message, err.stack)
})
process.on('unhandledRejection', (err) => {
  console.error('[FATAL] Unhandled rejection (keeping alive):', err?.message || err, err?.stack)
})

const app = express()
app.use(cors())
app.use(express.json())

const PORT = process.env.PORT || 3003
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://joeklgpncbrhnujzdzsp.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpvZWtsZ3BuY2JyaG51anpkenNwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODM1MDU4OSwiZXhwIjoyMDkzOTI2NTg5fQ.qSjr5JCxcw0wzl3_IypMMxWQhFl5FJ4IskiH04YPmiI'

const sessions = new SessionManager({
  supabaseUrl: SUPABASE_URL,
  supabaseKey: SUPABASE_KEY,
  onMessage: handleIncomingMessage,
})

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'solis-whatsapp', sessions: sessions.getActiveCount() })
})

app.post('/api/whatsapp/connect', async (req, res) => {
  const { business_id, phone_number } = req.body
  if (!business_id) return res.status(400).json({ error: 'business_id required' })

  try {
    const result = await sessions.connect(business_id, phone_number)
    res.json(result)
  } catch (err) {
    console.error('Connect error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/whatsapp/pairing-code/:businessId', (req, res) => {
  const { businessId } = req.params
  const code = sessions.getPairingCode(businessId)
  const status = sessions.getStatus(businessId)
  res.json({ code, status })
})

app.get('/api/whatsapp/qr/:businessId', async (req, res) => {
  const { businessId } = req.params
  const qr = sessions.getQR(businessId)
  if (!qr) return res.json({ qr: null, status: sessions.getStatus(businessId) })
  res.json({ qr, status: 'waiting_scan' })
})

app.get('/api/whatsapp/status/:businessId', (req, res) => {
  const { businessId } = req.params
  res.json({
    status: sessions.getStatus(businessId),
    phone: sessions.getPhone(businessId),
  })
})

app.post('/api/whatsapp/disconnect', async (req, res) => {
  const { business_id } = req.body
  if (!business_id) return res.status(400).json({ error: 'business_id required' })

  try {
    await sessions.disconnect(business_id)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/whatsapp/send', async (req, res) => {
  const { business_id, phone, message } = req.body
  if (!business_id || !phone || !message) {
    return res.status(400).json({ error: 'business_id, phone, message required' })
  }

  try {
    const result = await sessions.sendMessage(business_id, phone, message)
    logMessage(business_id, phone, 'outbound', message, result?.messageId)
    res.json({ success: true, messageId: result?.messageId || null })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/whatsapp/messages/:businessId', (req, res) => {
  const bizId = req.params.businessId
  const messages = getMessages(bizId)
  const status = sessions.getStatus(bizId)
  const phone = sessions.getPhone(bizId)
  const resolved = messages.map(m => {
    const resolvedPhone = sessions.resolvePhone(bizId, m.phone)
    if (resolvedPhone !== m.phone) return { ...m, phone: resolvedPhone }
    return m
  })
  res.json({ messages: resolved, connectionStatus: status, connectedPhone: phone })
})

app.delete('/api/whatsapp/messages/:businessId/:phone', (req, res) => {
  const { businessId, phone } = req.params
  const ok = clearMessages(businessId, phone)
  res.json({ success: ok })
})

app.delete('/api/whatsapp/messages/:businessId', (req, res) => {
  const { businessId } = req.params
  const ok = clearMessages(businessId)
  res.json({ success: ok })
})

app.post('/api/whatsapp/campaign-stats', (req, res) => {
  const { business_id, message_ids, phones, sent_after } = req.body
  if (!business_id) return res.status(400).json({ error: 'business_id required' })

  const result = { delivered: 0, read: 0, replied: 0 }

  if (message_ids && message_ids.length > 0) {
    const statuses = getMessageStatuses(business_id, message_ids)
    for (const id of message_ids) {
      const s = statuses[id]
      if (s) {
        if (s.status >= 3) result.delivered++
        if (s.status >= 4) result.read++
      }
    }
  }

  if (phones && phones.length > 0 && sent_after) {
    const messages = getMessages(business_id)
    const phoneSet = new Set(phones.map(p => p.replace(/\D/g, '')))
    const sentTime = new Date(sent_after).getTime()
    const repliedPhones = new Set()
    for (const msg of messages) {
      if (msg.direction === 'inbound' && new Date(msg.timestamp).getTime() > sentTime) {
        const msgPhone = msg.phone.replace(/\D/g, '')
        if (phoneSet.has(msgPhone) && !repliedPhones.has(msgPhone)) {
          repliedPhones.add(msgPhone)
          result.replied++
        }
      }
    }
  }

  res.json(result)
})

// Test endpoint - simulates a message and returns what the bot would reply
app.post('/api/whatsapp/test', async (req, res) => {
  const { business_id, phone, message } = req.body
  if (!business_id || !message) {
    return res.status(400).json({ error: 'business_id and message required' })
  }

  let botReply = null
  const fakeSock = {
    sendMessage: async (_jid, msg) => { botReply = msg.text },
    user: { id: 'test@s.whatsapp.net' },
  }

  try {
    await handleIncomingMessage({
      businessId: business_id,
      senderPhone: phone || 'test_user',
      text: message,
      sock: fakeSock,
      jid: (phone || 'test_user') + '@s.whatsapp.net',
      supabaseUrl: SUPABASE_URL,
      supabaseKey: SUPABASE_KEY,
    })
    res.json({ reply: botReply, status: 'ok' })
  } catch (err) {
    res.json({ reply: null, error: err.message, status: 'error' })
  }
})

app.get('/api/whatsapp/debug/:businessId', (req, res) => {
  const { businessId } = req.params
  res.json({
    status: sessions.getStatus(businessId),
    phone: sessions.getPhone(businessId),
    hasPairingCode: !!sessions.getPairingCode(businessId),
    pairingCode: sessions.getPairingCode(businessId),
    hasQR: !!sessions.getQR(businessId),
    hasSession: sessions.sessions.has(businessId),
    isConnected: sessions.sessions.get(businessId)?.connected || false,
  })
})

// Force reconnect - kills current session and creates fresh one
app.post('/api/whatsapp/reconnect', async (req, res) => {
  const { business_id } = req.body
  if (!business_id) return res.status(400).json({ error: 'business_id required' })

  try {
    console.log(`[WA] Force reconnecting ${business_id}`)
    sessions._reconnecting.delete(business_id)
    sessions._closeSocket(business_id)
    sessions.sessions.delete(business_id)
    sessions.qrCodes.delete(business_id)
    sessions.pairingCodes.delete(business_id)
    sessions.statuses.set(business_id, 'connecting')

    const result = await sessions._createSession(business_id)
    res.json({ success: true, ...result })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Send a test ping message to verify the connection is truly alive
app.post('/api/whatsapp/ping', async (req, res) => {
  const { business_id, phone } = req.body
  if (!business_id || !phone) return res.status(400).json({ error: 'business_id and phone required' })

  try {
    const session = sessions.sessions.get(business_id)
    if (!session?.connected || !session?.sock) {
      return res.json({ alive: false, reason: 'not connected' })
    }
    const jid = phone.replace(/[^0-9]/g, '') + '@s.whatsapp.net'
    await session.sock.sendMessage(jid, { text: '✅ Bot is online and working!' })
    res.json({ alive: true, sent: true })
  } catch (err) {
    res.json({ alive: false, reason: err.message })
  }
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Solis WhatsApp service running on port ${PORT}`)
  sessions.restoreAll()
})
