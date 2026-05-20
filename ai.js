const Anthropic = require('@anthropic-ai/sdk');

let client = null;
function getClient() {
  if (!client && process.env.ANTHROPIC_API_KEY) {
    client = new Anthropic();
  }
  return client;
}

const conversationHistory = new Map();
const HISTORY_TTL = 30 * 60 * 1000;
const MAX_HISTORY = 10;

function getHistory(sessionId) {
  const entry = conversationHistory.get(sessionId);
  if (entry && Date.now() - entry.lastActive < HISTORY_TTL) {
    entry.lastActive = Date.now();
    return entry.messages;
  }
  const messages = [];
  conversationHistory.set(sessionId, { messages, lastActive: Date.now() });
  return messages;
}

function buildSystemPrompt(bizName, services, biz, schedule, lang) {
  let servicesText = 'No services listed yet.';
  if (services && services.length > 0) {
    servicesText = services.map(s => {
      let line = `- ${s.name}`;
      if (s.duration) line += ` (${s.duration} min)`;
      if (s.price) line += ` - $${s.price}`;
      return line;
    }).join('\n');
  }

  let hoursText = 'Opening hours not set.';
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const sched = schedule || {};
  if (Object.keys(sched).length > 0) {
    hoursText = days.map(day => {
      const d = sched[day];
      if (!d) return `${day}: Not set`;
      const isOpen = d.enabled !== false && d.off !== true;
      const startTime = d.open || d.start;
      const endTime = d.close || d.end;
      if (isOpen && startTime) return `${day}: ${startTime} - ${endTime}`;
      return `${day}: Closed`;
    }).join('\n');
  }

  const parts = [];
  if (biz?.address) parts.push(biz.address);
  if (biz?.city) parts.push(biz.city);
  if (biz?.country) parts.push(biz.country);
  const locationText = parts.length > 0 ? parts.join(', ') : 'Location not set.';

  return `You are Solis AI, the intelligent WhatsApp assistant for ${bizName}. You are built into the Solis OS platform. Never mention Claude, Anthropic, OpenAI, ChatGPT, or any other AI company. You are simply the smart assistant for ${bizName}.

BUSINESS: ${bizName}
${biz?.industry ? `INDUSTRY: ${biz.industry}` : ''}

SERVICES:
${servicesText}

OPENING HOURS:
${hoursText}

LOCATION: ${locationText}
${biz?.phone ? `PHONE: ${biz.phone}` : ''}
${biz?.email ? `EMAIL: ${biz.email}` : ''}

YOUR ROLE:
- You are the friendly AI assistant for ${bizName}, helping their customers via WhatsApp
- Answer questions about the business, services, prices, hours, and location
- If a customer wants to book, tell them to type "book" or "2" to start the booking process
- If a customer wants to see prices, tell them to type "3" or "prices"
- Be helpful, warm, and professional
- Keep responses SHORT - this is WhatsApp. 2-3 short paragraphs max.
- Do NOT use markdown formatting (no **, no ##). Use plain text with line breaks.
- Use emojis sparingly to keep it friendly.
- Respond in the same language the customer writes in.
- If you don't know something specific about the business, say you'll check with the team.
- Never make up information about the business that isn't listed above.
- If asked who you are, say "I'm the smart assistant for ${bizName}, powered by Solis OS."`;
}

async function getAIResponse(userMessage, sessionId, bizName, services, biz, schedule, lang) {
  const anthropic = getClient();
  if (!anthropic) return null;

  try {
    const history = getHistory(sessionId);
    history.push({ role: 'user', content: userMessage });
    if (history.length > MAX_HISTORY * 2) {
      history.splice(0, history.length - MAX_HISTORY * 2);
    }

    const systemPrompt = buildSystemPrompt(bizName, services, biz, schedule, lang);

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 250,
      system: systemPrompt + `\n\nThe customer's detected language is: ${lang}. Respond in that language.`,
      messages: history,
    });

    const reply = response.content[0]?.text;
    if (reply) {
      history.push({ role: 'assistant', content: reply });
      return reply;
    }
    return null;
  } catch (err) {
    console.error('[AI] Response error:', err.message);
    return null;
  }
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of conversationHistory) {
    if (now - entry.lastActive > HISTORY_TTL) conversationHistory.delete(key);
  }
}, 5 * 60 * 1000);

module.exports = { getAIResponse };
