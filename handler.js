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

  return data
}

function detectLanguage(text) {
  const arabicRegex = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/
  if (arabicRegex.test(text)) return 'ar'
  const t = text.toLowerCase()
  const frenchWords = ['bonjour', 'salut', 'merci', 'comment', 'rendez', 'coiffeur', 'coupe', 'prix', 'combien', 'reserver', 'réserver']
  if (frenchWords.some(w => t.includes(w))) return 'fr'
  const spanishWords = ['hola', 'gracias', 'cita', 'reservar', 'precio', 'corte', 'quiero', 'necesito', 'cuando']
  if (spanishWords.some(w => t.includes(w))) return 'es'
  return 'en'
}

function detectIntent(text) {
  const t = text.toLowerCase().trim()

  if (/\b(book|books|booking|bookings|appointment|appointments|schedule|reserve|reservation|slot|slots|available|availability|when can|tomorrow|today|time|follow.?up|check.?up|checkup|visit|come in|walk.?in|consultation|consult|session|rendez.?vous|cita|موعد|حجز|rdv)\b/.test(t))
    return 'booking'
  if (/\b(price|prices|pricing|cost|costs|how much|rate|rates|fee|fees|charge|charges|tarif|tarifs|tariff|pay|payment|invoice|facture|سعر|اسعار|كم|prix|combien|precio|cuanto)\b/.test(t))
    return 'pricing'
  if (/\b(service|services|what do you|what can|offer|offers|menu|treatment|treatments|list|result|results|catalog|catalogue|do you do|can you do|what.*available|lab|lab work|labs|test|tests|testing|exam|procedure|procedures|haircut|cut|trim|style|styling|massage|facial|manicure|pedicure|wash|color|colour|dye|خدم|servicio|prestation)\b/.test(t))
    return 'services'
  if (/\b(hour|hours|open|close|opening|closing|working|when are|what time|timing|timings|horaire|horario|ساعات|وقت|مواعيد)\b/.test(t))
    return 'hours'
  if (/\b(cancel|cancellation|reschedule|change|move|postpone|annuler|cancelar|الغاء)\b/.test(t))
    return 'cancel'
  if (/\b(where|address|location|directions|find you|map|gps|عنوان|موقع|adresse|direccion|ubicacion)\b/.test(t))
    return 'location'
  if (/\b(hi|hello|hey|good morning|good afternoon|good evening|howdy|sup|salam|salut|bonjour|hola|مرحبا|اهلا|السلام)\b/.test(t))
    return 'greeting'
  if (/\b(thank|thanks|thx|cheers|appreciate|merci|gracias|shukran|شكرا)\b/.test(t))
    return 'thanks'
  if (/\b(help|support|problem|issue|question|info|information|details|مساعدة|aide|ayuda)\b/.test(t))
    return 'help'
  if (/\b(yes|yeah|yep|sure|ok|okay|confirm|perfect|great|sounds good|that works|go ahead|done|let's go|absolutely|oui|si|نعم|اكيد|تمام)\b/.test(t))
    return 'confirm'

  return 'services'
}

function formatServices(services) {
  if (!services || !Array.isArray(services) || services.length === 0) return null

  return services
    .filter(s => s.name)
    .map(s => {
      let line = `• ${s.name}`
      if (s.duration) line += ` (${s.duration} min)`
      if (s.price) line += ` - $${s.price}`
      return line
    })
    .join('\n')
}

function getAvailableSlots(schedule) {
  if (!schedule) return null

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const today = new Date()
  const dayName = days[today.getDay()]

  const todaySchedule = schedule[dayName.toLowerCase()] || schedule[dayName]
  if (!todaySchedule || todaySchedule.off) return null

  return todaySchedule
}

function generateResponse(intent, businessData, lang) {
  const biz = businessData.business_info || {}
  const rawName = biz.name || 'our business'
  const bizName = rawName.charAt(0).toUpperCase() + rawName.slice(1)
  const services = businessData.services || []
  const schedule = businessData.schedule || {}

  const translations = {
    en: {
      greeting: `Hi there! 👋 Welcome to ${bizName}. I'm your AI assistant and I'm here to help you 24/7.\n\nI can help you with:\n📅 Booking an appointment\n💰 Service prices\n🕐 Opening hours\n📍 Location\n\nWhat would you like to know?`,

      booking: (() => {
        const serviceList = formatServices(services)
        if (serviceList) {
          return `I'd love to help you book an appointment at ${bizName}! 📅\n\nHere are our services:\n${serviceList}\n\nWhich service are you interested in, and what day/time works best for you?`
        }
        return `I'd love to help you book an appointment at ${bizName}! 📅\n\nWhat service are you looking for, and when would you like to come in?`
      })(),

      pricing: (() => {
        const serviceList = formatServices(services)
        if (serviceList) {
          return `Here are our prices at ${bizName}:\n\n${serviceList}\n\nWould you like to book any of these?`
        }
        return `For pricing information at ${bizName}, please let me know which service you're interested in and I'll get you the details!`
      })(),

      services: (() => {
        const serviceList = formatServices(services)
        if (serviceList) {
          return `Here's what we offer at ${bizName}:\n\n${serviceList}\n\nInterested in any of these? I can book you in!`
        }
        return `Thanks for your interest in ${bizName}! 😊\n\nI'd love to help you. Could you tell me a bit more about what you need? For example:\n\n📅 Want to book? Tell me the date and time\n💰 Need pricing? Ask about any specific service\n🕐 Opening hours? Just ask!\n\nI'm here to help with anything!`
      })(),

      hours: (() => {
        if (biz.schedule || Object.keys(schedule).length > 0) {
          const s = biz.schedule || schedule
          let lines = `Our opening hours at ${bizName}:\n\n`
          const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
          for (const day of days) {
            const d = s[day]
            if (d && !d.off && d.start) {
              lines += `${day.charAt(0).toUpperCase() + day.slice(1)}: ${d.start} - ${d.end}\n`
            } else if (d?.off) {
              lines += `${day.charAt(0).toUpperCase() + day.slice(1)}: Closed\n`
            }
          }
          return lines + '\nWould you like to book an appointment?'
        }
        return `For our opening hours at ${bizName}, feel free to ask and I'll check for you! Would you like to book an appointment?`
      })(),

      location: (() => {
        const parts = []
        if (biz.address) parts.push(biz.address)
        if (biz.city) parts.push(biz.city)
        if (biz.country) parts.push(biz.country)
        if (parts.length > 0) {
          return `📍 You can find us at:\n${parts.join(', ')}\n\nNeed directions or want to book a visit?`
        }
        return `For our location details, please let me know and I'll help you find us!`
      })(),

      cancel: `I understand you'd like to cancel or reschedule. No problem at all!\n\nCould you give me your name and the date of your appointment? I'll sort it out for you right away.`,

      thanks: `You're welcome! 😊 If you need anything else, just message me anytime. Have a great day! 👋`,

      confirm: `Great! ✅ Let me get that sorted for you. Could you share:\n\n1. Your name\n2. Preferred date and time\n3. The service you'd like\n\nI'll confirm your booking right away!`,

      help: `I'm here to help! At ${bizName}, I can assist you with:\n\n📅 Booking appointments\n💰 Pricing information\n🕐 Opening hours\n📍 Our location\n🔄 Rescheduling or cancellations\n\nJust let me know what you need!`,

      unknown: `Thanks for your message! I'm the AI assistant for ${bizName}. I can help you with:\n\n📅 Bookings - just say "book"\n💰 Prices - just say "prices"\n🕐 Hours - just say "hours"\n\nOr tell me what you're looking for and I'll do my best to help!`,
    },

    fr: {
      greeting: `Bonjour ! 👋 Bienvenue chez ${bizName}. Je suis votre assistant IA, disponible 24h/24.\n\nJe peux vous aider avec :\n📅 Prendre rendez-vous\n💰 Nos tarifs\n🕐 Horaires d'ouverture\n📍 Adresse\n\nQue puis-je faire pour vous ?`,
      booking: `Je serais ravi de vous aider à réserver chez ${bizName} ! 📅\n\nQuel service vous intéresse et quand souhaitez-vous venir ?`,
      pricing: `Pour les tarifs de ${bizName}, n'hésitez pas à me demander le service qui vous intéresse !`,
      unknown: `Merci pour votre message ! Je suis l'assistant IA de ${bizName}. Dites "réserver", "prix" ou "horaires" et je vous aide tout de suite !`,
    },

    es: {
      greeting: `¡Hola! 👋 Bienvenido a ${bizName}. Soy tu asistente de IA, disponible 24/7.\n\nPuedo ayudarte con:\n📅 Reservar una cita\n💰 Precios\n🕐 Horarios\n📍 Ubicación\n\n¿En qué puedo ayudarte?`,
      booking: `¡Me encantaría ayudarte a reservar en ${bizName}! 📅\n\n¿Qué servicio te interesa y cuándo te gustaría venir?`,
      pricing: `Para los precios de ${bizName}, dime qué servicio te interesa y te doy los detalles.`,
      unknown: `¡Gracias por tu mensaje! Soy el asistente de IA de ${bizName}. Di "reservar", "precios" u "horarios" y te ayudo enseguida.`,
    },

    ar: {
      greeting: `مرحباً! 👋 أهلاً بك في ${bizName}. أنا مساعدك الذكي، متاح 24/7.\n\nيمكنني مساعدتك في:\n📅 حجز موعد\n💰 الأسعار\n🕐 أوقات العمل\n📍 الموقع\n\nكيف يمكنني مساعدتك؟`,
      unknown: `شكراً لرسالتك! أنا المساعد الذكي لـ ${bizName}. قل "حجز" أو "أسعار" أو "مواعيد" وسأساعدك فوراً!`,
    },
  }

  const langResponses = translations[lang] || translations['en']
  const enResponses = translations['en']

  return langResponses[intent] || enResponses[intent] || enResponses['unknown']
}

const recentReplies = new Map()

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
  const lang = detectLanguage(text)
  const intent = detectIntent(text)

  console.log(`[MSG] ${businessId} | ${senderPhone} | lang=${lang} intent=${intent} | "${text.slice(0, 50)}"`)

  const response = generateResponse(intent, businessData, lang)

  await sock.sendMessage(jid, { text: response })
}

module.exports = { handleIncomingMessage }
