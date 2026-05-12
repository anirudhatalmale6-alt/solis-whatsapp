const SUPABASE_BUCKET = 'business-data'

async function fetchBusinessData(supabaseUrl, supabaseKey, businessId) {
  const keys = ['services', 'bookings', 'schedule', 'business_info']
  const data = {}

  for (const key of keys) {
    try {
      const resp = await fetch(
        `${supabaseUrl}/storage/v1/object/${SUPABASE_BUCKET}/${businessId}/${key}.json`,
        { headers: { 'Authorization': `Bearer ${supabaseKey}` } }
      )
      if (resp.ok) {
        const text = await resp.text()
        if (text) data[key] = JSON.parse(text)
      }
    } catch {}
  }

  try {
    const resp = await fetch(
      `${supabaseUrl}/rest/v1/businesses?id=eq.${businessId}&select=*`,
      {
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
        }
      }
    )
    if (resp.ok) {
      const rows = await resp.json()
      if (rows[0]) data.business_info = { ...data.business_info, ...rows[0] }
    }
  } catch {}

  if (!data.services || !Array.isArray(data.services) || data.services.length === 0) {
    try {
      const resp = await fetch(
        `${supabaseUrl}/rest/v1/services?business_id=eq.${businessId}&select=*`,
        {
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'apikey': supabaseKey,
          }
        }
      )
      if (resp.ok) {
        const rows = await resp.json()
        if (rows.length > 0) data.services = rows
      }
    } catch {}
  }

  if (!data.schedule || Object.keys(data.schedule).length === 0) {
    try {
      const resp = await fetch(
        `${supabaseUrl}/rest/v1/schedules?business_id=eq.${businessId}&select=*`,
        {
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'apikey': supabaseKey,
          }
        }
      )
      if (resp.ok) {
        const rows = await resp.json()
        if (rows[0]) data.schedule = rows[0]
      }
    } catch {}
  }

  return data
}

// ── Conversation state per user ──
// States: greeting, menu, services, pick_service, confirm_service, ask_name, ask_date, confirm_booking, done
const conversations = new Map()
const CONV_TIMEOUT = 30 * 60 * 1000 // 30 min

function getConv(key) {
  const c = conversations.get(key)
  if (c && Date.now() - c.updated < CONV_TIMEOUT) return c
  return null
}

function setConv(key, state, extra = {}) {
  conversations.set(key, { state, ...extra, updated: Date.now() })
  if (conversations.size > 10000) {
    const cutoff = Date.now() - CONV_TIMEOUT
    for (const [k, v] of conversations) {
      if (v.updated < cutoff) conversations.delete(k)
    }
  }
}

function clearConv(key) { conversations.delete(key) }

// ── Helpers ──

function isYes(t) {
  return /^(yes|yeah|yep|yea|y|sure|ok|okay|oui|si|نعم|اكيد|تمام|da|ja|1)$/i.test(t.trim())
}

function isNo(t) {
  return /^(no|nah|nope|non|لا|nie|nein|2)$/i.test(t.trim())
}

function formatServiceList(services) {
  if (!services || services.length === 0) return null
  return services
    .filter(s => s.name)
    .map((s, i) => {
      let line = `${i + 1}. ${s.name}`
      if (s.duration) line += ` (${s.duration} min)`
      if (s.price) line += ` - $${s.price}`
      return line
    })
    .join('\n')
}

function formatServiceLine(s) {
  let line = s.name
  if (s.duration) line += ` (${s.duration} min)`
  if (s.price) line += ` - $${s.price}`
  return line
}

function findServiceByInput(text, services) {
  if (!services || services.length === 0) return null
  const t = text.trim()

  // Try number first
  const num = parseInt(t)
  if (!isNaN(num) && num >= 1 && num <= services.length) {
    return services[num - 1]
  }

  // Try exact name match
  const lo = t.toLowerCase()
  for (const s of services) {
    if (!s.name) continue
    if (s.name.toLowerCase() === lo) return s
  }

  // Try partial match
  for (const s of services) {
    if (!s.name) continue
    const sName = s.name.toLowerCase()
    if (lo.includes(sName) || sName.includes(lo)) {
      if (lo.length >= 3) return s
    }
  }
  return null
}

function getBizName(biz) {
  const raw = biz?.name || 'our business'
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

function formatHours(biz, schedule) {
  const s = biz?.schedule || schedule || {}
  if (Object.keys(s).length === 0) return null
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  let lines = ''
  for (const day of days) {
    const d = s[day]
    if (d && !d.off && d.start) {
      lines += `${day.charAt(0).toUpperCase() + day.slice(1)}: ${d.start} - ${d.end}\n`
    } else if (d?.off) {
      lines += `${day.charAt(0).toUpperCase() + day.slice(1)}: Closed\n`
    }
  }
  return lines || null
}

function formatLocation(biz) {
  const parts = []
  if (biz?.address) parts.push(biz.address)
  if (biz?.city) parts.push(biz.city)
  if (biz?.country) parts.push(biz.country)
  return parts.length > 0 ? parts.join(', ') : null
}

// ── Rate limiter ──
const recentReplies = new Map()

// ── Main handler ──

async function handleIncomingMessage({ businessId, senderPhone, text, sock, jid, supabaseUrl, supabaseKey }) {
  const replyKey = `${businessId}:${senderPhone}`
  const now = Date.now()
  const lastReply = recentReplies.get(replyKey) || 0
  if (now - lastReply < 3000) return
  recentReplies.set(replyKey, now)

  if (recentReplies.size > 5000) {
    const cutoff = now - 300000
    for (const [k, v] of recentReplies) {
      if (v < cutoff) recentReplies.delete(k)
    }
  }

  const businessData = await fetchBusinessData(supabaseUrl, supabaseKey, businessId)
  const biz = businessData.business_info || {}
  const bizName = getBizName(biz)
  const services = businessData.services || []
  const schedule = businessData.schedule || {}
  const t = text.trim()
  const lo = t.toLowerCase()

  const convKey = replyKey
  const conv = getConv(convKey)

  console.log(`[MSG] ${businessId} | ${senderPhone} | state=${conv?.state || 'none'} | "${t.slice(0, 60)}"`)

  let reply = ''

  // ── Handle based on conversation state ──

  if (conv?.state === 'pick_service') {
    const picked = findServiceByInput(t, services)
    if (picked) {
      setConv(convKey, 'confirm_service', { service: picked })
      reply = `You selected:\n\n📋 ${formatServiceLine(picked)}\n\nWould you like to book this service?\n\nReply *Yes* or *No*`
    } else if (isNo(t)) {
      reply = mainMenu(bizName)
      setConv(convKey, 'menu')
    } else {
      reply = `I didn't find that service. Please reply with the *number* from the list above.\n\nOr reply *No* to go back to the menu.`
    }
  }

  else if (conv?.state === 'confirm_service') {
    if (isYes(t)) {
      setConv(convKey, 'ask_name', { service: conv.service })
      reply = `Great! 📝\n\nPlease type your *full name*:`
    } else if (isNo(t)) {
      reply = mainMenu(bizName)
      setConv(convKey, 'menu')
    } else {
      reply = `Please reply *Yes* to book or *No* to go back.`
    }
  }

  else if (conv?.state === 'ask_name') {
    if (isNo(t)) {
      reply = mainMenu(bizName)
      setConv(convKey, 'menu')
    } else if (t.length >= 2 && /[a-zA-Z؀-ۿÀ-ɏ]/.test(t)) {
      setConv(convKey, 'ask_date', { service: conv.service, name: t })
      reply = `Thanks ${t}! 👋\n\nPlease type your *preferred date and time*.\n\nExample: 16/5/2026 2:30pm`
    } else {
      reply = `Please type your full name.\n\nOr reply *No* to cancel.`
    }
  }

  else if (conv?.state === 'ask_date') {
    if (isNo(t)) {
      reply = mainMenu(bizName)
      setConv(convKey, 'menu')
    } else if (t.length >= 3) {
      setConv(convKey, 'confirm_booking', { service: conv.service, name: conv.name, dateTime: t })
      reply = `Please confirm your booking:\n\n📋 Service: ${formatServiceLine(conv.service)}\n👤 Name: ${conv.name}\n📅 Date/Time: ${t}\n🏥 At: ${bizName}\n\nIs this correct?\n\nReply *Yes* to confirm or *No* to cancel`
    } else {
      reply = `Please type your preferred date and time.\n\nExample: Tomorrow 3pm\n\nOr reply *No* to cancel.`
    }
  }

  else if (conv?.state === 'confirm_booking') {
    if (isYes(t)) {
      clearConv(convKey)
      reply = `✅ Booking Confirmed!\n\n📋 ${formatServiceLine(conv.service)}\n👤 ${conv.name}\n📅 ${conv.dateTime}\n🏥 ${bizName}\n\nThank you! We'll see you then. 😊\n\nNeed anything else? Just send a message anytime!`
    } else if (isNo(t)) {
      clearConv(convKey)
      reply = `No problem! Your booking was not made.\n\nWould you like to start over?\n\nReply *Yes* or just send a new message anytime!`
    } else {
      reply = `Please reply *Yes* to confirm your booking or *No* to cancel.`
    }
  }

  else if (conv?.state === 'menu') {
    reply = handleMenuChoice(lo, bizName, services, biz, schedule)
    if (reply.nextState) {
      setConv(convKey, reply.nextState)
      reply = reply.text
    } else {
      reply = reply.text
    }
  }

  // ── No active conversation or fresh message ──
  else {
    // Check for direct intents even without state
    const result = handleMenuChoice(lo, bizName, services, biz, schedule)
    if (result.nextState) {
      setConv(convKey, result.nextState)
    } else {
      setConv(convKey, 'menu')
    }
    reply = result.text
  }

  await sock.sendMessage(jid, { text: reply })
}

// ── Menu handler ──

function mainMenu(bizName) {
  return `Welcome to ${bizName}! 👋\n\nHow can I help you today?\n\n1️⃣ View our services\n2️⃣ Book an appointment\n3️⃣ View prices\n4️⃣ Opening hours\n5️⃣ Our location\n\nReply with a *number* or type your question!`
}

function handleMenuChoice(input, bizName, services, biz, schedule) {
  const t = input.trim()

  // Number choices
  if (t === '1' || /\b(service|services|what do you|what can|offer|menu|list|catalog)\b/.test(t)) {
    return showServices(bizName, services)
  }
  if (t === '2' || /\b(book|appointment|reserve|schedule|rdv|cita|حجز|rendez)\b/.test(t)) {
    return showServices(bizName, services, true)
  }
  if (t === '3' || /\b(price|prices|pricing|cost|how much|fee|tarif|prix|سعر|اسعار|كم|precio)\b/.test(t)) {
    return showPrices(bizName, services)
  }
  if (t === '4' || /\b(hour|hours|open|close|opening|closing|when|time|timing|horaire|ساعات)\b/.test(t)) {
    return showHours(bizName, biz, schedule)
  }
  if (t === '5' || /\b(where|address|location|direction|map|عنوان|موقع|adresse|direccion)\b/.test(t)) {
    return showLocation(bizName, biz)
  }

  // Greetings
  if (/^(hi|hello|hey|good morning|good afternoon|good evening|salam|salut|bonjour|hola|مرحبا|اهلا)$/i.test(t) || /\b(hi|hello|hey)\b/.test(t)) {
    return { text: mainMenu(bizName) }
  }

  // Thanks
  if (/\b(thank|thanks|thx|merci|gracias|شكرا)\b/.test(t)) {
    return { text: `You're welcome! 😊\n\nNeed anything else?\n\nReply *Yes* to see the menu or just send a new message anytime!` }
  }

  // Cancel/reschedule
  if (/\b(cancel|reschedule|annuler|cancelar|الغاء)\b/.test(t)) {
    return { text: `To cancel or reschedule, please provide:\n\n1. Your name\n2. Date of your appointment\n\nWe'll sort it out for you!\n\nOr reply *No* to go back to the menu.` }
  }

  // Yes (after done/thanks)
  if (isYes(t)) {
    return { text: mainMenu(bizName) }
  }

  // Default: show menu
  return { text: mainMenu(bizName) }
}

function showServices(bizName, services, forBooking = false) {
  const list = formatServiceList(services)
  if (list) {
    const header = forBooking
      ? `Let's book an appointment at ${bizName}! 📅\n\nChoose a service:\n\n`
      : `Here are our services at ${bizName}:\n\n`
    return {
      text: `${header}${list}\n\nReply with the *number* of the service you'd like.\n\nOr reply *No* to go back.`,
      nextState: 'pick_service'
    }
  }
  return { text: `We haven't listed our services yet. Please contact us directly!\n\nWould you like to see the menu?\n\nReply *Yes* or *No*` }
}

function showPrices(bizName, services) {
  const list = formatServiceList(services)
  if (list) {
    return {
      text: `💰 Prices at ${bizName}:\n\n${list}\n\nWould you like to book any of these?\n\nReply *Yes* or *No*`,
    }
  }
  return { text: `Pricing information coming soon! Contact us for details.\n\nWould you like to see the menu?\n\nReply *Yes* or *No*` }
}

function showHours(bizName, biz, schedule) {
  const hours = formatHours(biz, schedule)
  if (hours) {
    return { text: `🕐 Opening hours at ${bizName}:\n\n${hours}\nWould you like to book an appointment?\n\nReply *Yes* or *No*` }
  }
  return { text: `Our opening hours are not set yet. Please contact us directly!\n\nWould you like to see the menu?\n\nReply *Yes* or *No*` }
}

function showLocation(bizName, biz) {
  const loc = formatLocation(biz)
  if (loc) {
    return { text: `📍 Find us at:\n${loc}\n\nWould you like to book a visit?\n\nReply *Yes* or *No*` }
  }
  return { text: `Our location details are not set yet. Please contact us directly!\n\nWould you like to see the menu?\n\nReply *Yes* or *No*` }
}

module.exports = { handleIncomingMessage }
