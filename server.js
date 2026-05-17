const express = require('express')
const cors = require('cors')
const { SessionManager } = require('./sessions')
const { handleIncomingMessage } = require('./handler')
const { logMessage, getMessages } = require('./messageLog')

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
    await sessions.sendMessage(business_id, phone, message)
    logMessage(business_id, phone, 'outbound', message)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/whatsapp/messages/:businessId', (req, res) => {
  res.json(getMessages(req.params.businessId))
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Solis WhatsApp service running on port ${PORT}`)
  sessions.restoreAll()
})
