const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys')
const { Boom } = require('@hapi/boom')
const fs = require('fs')
const path = require('path')
const pino = require('pino')
const QRCode = require('qrcode')

const AUTH_BASE = process.env.AUTH_DIR || '/opt/solis-whatsapp/sessions'

class SessionManager {
  constructor({ supabaseUrl, supabaseKey, onMessage }) {
    this.supabaseUrl = supabaseUrl
    this.supabaseKey = supabaseKey
    this.onMessage = onMessage
    this.sessions = new Map()
    this.qrCodes = new Map()
    this.statuses = new Map()
    this.phones = new Map()
    this.pairingCodes = new Map()
    this._reconnecting = new Set()

    if (!fs.existsSync(AUTH_BASE)) {
      fs.mkdirSync(AUTH_BASE, { recursive: true })
    }
  }

  getActiveCount() {
    let count = 0
    for (const [, s] of this.sessions) {
      if (s.connected) count++
    }
    return count
  }

  getQR(businessId) { return this.qrCodes.get(businessId) || null }
  getStatus(businessId) { return this.statuses.get(businessId) || 'disconnected' }
  getPhone(businessId) { return this.phones.get(businessId) || null }
  getPairingCode(businessId) { return this.pairingCodes.get(businessId) || null }

  _closeSocket(businessId) {
    const session = this.sessions.get(businessId)
    if (session?.sock) {
      try { session.sock.ev.removeAllListeners() } catch {}
      try { session.sock.end() } catch {}
      session.sock = null
    }
  }

  async connect(businessId, phoneNumber) {
    if (this.sessions.has(businessId)) {
      const existing = this.sessions.get(businessId)
      if (existing.connected) {
        return { status: 'already_connected', phone: this.phones.get(businessId) }
      }
    }

    this._closeSocket(businessId)
    this._reconnecting.delete(businessId)
    this.statuses.set(businessId, 'connecting')

    const authDir = path.join(AUTH_BASE, businessId)
    if (phoneNumber && fs.existsSync(authDir)) {
      fs.rmSync(authDir, { recursive: true, force: true })
      console.log(`[WA] Cleared old session data for ${businessId}`)
    }

    return this._createSession(businessId, phoneNumber)
  }

  async _createSession(businessId, phoneNumber) {
    const authDir = path.join(AUTH_BASE, businessId)
    if (!fs.existsSync(authDir)) {
      fs.mkdirSync(authDir, { recursive: true })
    }

    const { state, saveCreds } = await useMultiFileAuthState(authDir)
    const { version } = await fetchLatestBaileysVersion()

    const usePairingCode = !!phoneNumber

    const sock = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: 'warn' }),
      printQRInTerminal: false,
      browser: ['Ubuntu', 'Chrome', '22.04.4'],
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 30000,
    })

    const sessionData = this.sessions.get(businessId) || { businessId, reconnectCount: 0 }
    sessionData.sock = sock
    sessionData.connected = false
    this.sessions.set(businessId, sessionData)

    if (usePairingCode && !state.creds.registered) {
      const cleanNumber = phoneNumber.replace(/[^0-9]/g, '')
      console.log(`[WA] Will request pairing code for ${businessId} with number: ${cleanNumber}`)
      setTimeout(async () => {
        try {
          if (!sessionData.connected) {
            const code = await sock.requestPairingCode(cleanNumber)
            console.log(`[WA] Pairing code for ${businessId}: ${code}`)
            this.pairingCodes.set(businessId, code)
            this.statuses.set(businessId, 'waiting_code')
          }
        } catch (err) {
          console.error(`[WA] Pairing code error:`, err.message)
          this.statuses.set(businessId, 'error')
        }
      }, 3000)
    }

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update

      // Ignore events from old sockets
      if (sessionData.sock !== sock) {
        console.log(`[WA] ${businessId} ignoring event from old socket`)
        return
      }

      console.log(`[WA] ${businessId} connection:`, JSON.stringify({
        connection, qr: !!qr,
        statusCode: lastDisconnect?.error?.output?.statusCode
      }))

      if (qr && !usePairingCode) {
        try {
          const qrDataUrl = await QRCode.toDataURL(qr, { width: 300, margin: 2 })
          this.qrCodes.set(businessId, qrDataUrl)
          this.statuses.set(businessId, 'waiting_scan')
        } catch {}
      }

      if (connection === 'open') {
        sessionData.connected = true
        sessionData.reconnectCount = 0
        this._reconnecting.delete(businessId)
        this.qrCodes.delete(businessId)
        this.pairingCodes.delete(businessId)
        this.statuses.set(businessId, 'connected')
        const phone = sock.user?.id?.split(':')[0] || sock.user?.id?.split('@')[0]
        this.phones.set(businessId, phone)
        console.log(`[WA] ${businessId} connected as ${phone}`)
        this._saveBusinessPhone(businessId, phone)
      }

      if (connection === 'close') {
        sessionData.connected = false
        const statusCode = lastDisconnect?.error?.output?.statusCode
        const errorMsg = lastDisconnect?.error?.message || 'unknown'
        console.log(`[WA] ${businessId} closed: code=${statusCode}, error=${errorMsg}`)

        const shouldReconnect = statusCode !== DisconnectReason.loggedOut

        if (shouldReconnect) {
          // Prevent duplicate reconnection attempts
          if (this._reconnecting.has(businessId)) {
            console.log(`[WA] ${businessId} reconnection already in progress, skipping`)
            return
          }

          if (!sessionData.reconnectCount) sessionData.reconnectCount = 0
          sessionData.reconnectCount++

          if (sessionData.reconnectCount > 15) {
            console.log(`[WA] ${businessId} too many reconnect attempts, stopping`)
            this.statuses.set(businessId, 'disconnected')
            this._reconnecting.delete(businessId)
            return
          }

          const delay = Math.min(5000 * sessionData.reconnectCount, 60000)
          console.log(`[WA] ${businessId} reconnecting (attempt ${sessionData.reconnectCount}) in ${delay}ms...`)
          this.statuses.set(businessId, 'reconnecting')
          this._reconnecting.add(businessId)

          setTimeout(async () => {
            this._reconnecting.delete(businessId)
            this._closeSocket(businessId)
            try {
              await this._createSession(businessId)
            } catch (err) {
              console.error(`[WA] ${businessId} reconnect failed:`, err.message)
              this.statuses.set(businessId, 'disconnected')
            }
          }, delay)
        } else {
          console.log(`[WA] ${businessId} logged out`)
          this._closeSocket(businessId)
          this.statuses.set(businessId, 'disconnected')
          this.phones.delete(businessId)
          this.sessions.delete(businessId)
          this._reconnecting.delete(businessId)
          const authDir = path.join(AUTH_BASE, businessId)
          if (fs.existsSync(authDir)) {
            fs.rmSync(authDir, { recursive: true, force: true })
          }
        }
      }
    })

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return
      if (sessionData.sock !== sock) return

      for (const msg of messages) {
        if (msg.key.fromMe) continue
        if (!msg.message) continue

        const jid = msg.key.remoteJid
        if (jid === 'status@broadcast') continue
        if (jid?.endsWith('@g.us')) continue

        const msgTimestamp = (msg.messageTimestamp?.low || msg.messageTimestamp || 0)
        const ageSeconds = Math.floor(Date.now() / 1000) - msgTimestamp
        if (ageSeconds > 120) continue

        const text = msg.message?.conversation
          || msg.message?.extendedTextMessage?.text
          || ''

        if (!text.trim()) continue

        const senderPhone = jid.split('@')[0]

        try {
          await this.onMessage({
            businessId,
            senderPhone,
            text: text.trim(),
            sock,
            jid,
            supabaseUrl: this.supabaseUrl,
            supabaseKey: this.supabaseKey,
          })
        } catch (err) {
          console.error(`[WA] ${businessId} handler error:`, err.message)
        }
      }
    })

    return { status: 'connecting', method: usePairingCode ? 'pairing_code' : 'qr' }
  }

  async _saveBusinessPhone(businessId, phone) {
    try {
      await fetch(
        `${this.supabaseUrl}/storage/v1/object/business-data/${businessId}/whatsapp_connection.json`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${this.supabaseKey}`,
            'Content-Type': 'application/json',
            'x-upsert': 'true',
          },
          body: JSON.stringify({ phone, connected_at: new Date().toISOString(), status: 'connected' }),
        }
      )
    } catch {}
  }

  async sendMessage(businessId, phone, message) {
    const session = this.sessions.get(businessId)
    if (!session?.connected) throw new Error('WhatsApp not connected')

    const jid = phone.replace(/[^0-9]/g, '') + '@s.whatsapp.net'
    await session.sock.sendMessage(jid, { text: message })
  }

  async disconnect(businessId) {
    this._reconnecting.delete(businessId)
    const session = this.sessions.get(businessId)
    if (session?.sock) {
      try { await session.sock.logout() } catch {}
      try { session.sock.ev.removeAllListeners() } catch {}
      try { session.sock.end() } catch {}
    }
    this.sessions.delete(businessId)
    this.qrCodes.delete(businessId)
    this.pairingCodes.delete(businessId)
    this.statuses.set(businessId, 'disconnected')
    this.phones.delete(businessId)

    const authDir = path.join(AUTH_BASE, businessId)
    if (fs.existsSync(authDir)) {
      fs.rmSync(authDir, { recursive: true, force: true })
    }
  }

  async restoreAll() {
    if (!fs.existsSync(AUTH_BASE)) return
    const dirs = fs.readdirSync(AUTH_BASE).filter(d => {
      return fs.statSync(path.join(AUTH_BASE, d)).isDirectory()
    })

    console.log(`[WA] Restoring ${dirs.length} sessions...`)
    for (const businessId of dirs) {
      try {
        await this._createSession(businessId)
        console.log(`[WA] Restored session for ${businessId}`)
      } catch (err) {
        console.error(`[WA] Failed to restore ${businessId}:`, err.message)
      }
    }
  }
}

module.exports = { SessionManager }
