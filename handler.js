const { logMessage } = require('./messageLog')
const { getAIResponse } = require('./ai')
const fs = require('fs')
const path = require('path')

// ── Multilingual support (8 languages) ──
const LANGS = {
  en: 'English',
  ar: 'العربية',
  fr: 'Français',
  es: 'Español',
  pt: 'Português',
  hi: 'हिन्दी',
  zh: '中文',
  it: 'Italiano',
}

const T = {
  welcome: {
    en: (biz) => `Welcome to ${biz}! 👋\n\nHow can I help you today?\n\n1️⃣ View our services\n2️⃣ Book an appointment\n3️⃣ View prices\n4️⃣ Opening hours\n5️⃣ Our location\n6️⃣ Visit our website 🌐\n7️⃣ Change language 🗣️\n\nReply with a *number* or type your question!`,
    ar: (biz) => `مرحباً بك في ${biz}! 👋\n\nكيف يمكنني مساعدتك اليوم؟\n\n1️⃣ عرض خدماتنا\n2️⃣ حجز موعد\n3️⃣ عرض الأسعار\n4️⃣ ساعات العمل\n5️⃣ موقعنا\n6️⃣ زوروا موقعنا الإلكتروني 🌐\n7️⃣ تغيير اللغة 🗣️\n\nأرسل *رقم* أو اكتب سؤالك!`,
    fr: (biz) => `Bienvenue chez ${biz}! 👋\n\nComment puis-je vous aider?\n\n1️⃣ Voir nos services\n2️⃣ Prendre rendez-vous\n3️⃣ Voir les prix\n4️⃣ Horaires d'ouverture\n5️⃣ Notre adresse\n6️⃣ Visitez notre site web 🌐\n7️⃣ Changer de langue 🗣️\n\nRépondez avec un *numéro* ou posez votre question!`,
    es: (biz) => `¡Bienvenido a ${biz}! 👋\n\n¿Cómo puedo ayudarte hoy?\n\n1️⃣ Ver nuestros servicios\n2️⃣ Reservar una cita\n3️⃣ Ver precios\n4️⃣ Horario de atención\n5️⃣ Nuestra ubicación\n6️⃣ Visita nuestro sitio web 🌐\n7️⃣ Cambiar idioma 🗣️\n\n¡Responde con un *número* o escribe tu pregunta!`,
    pt: (biz) => `Bem-vindo ao ${biz}! 👋\n\nComo posso ajudar?\n\n1️⃣ Ver nossos serviços\n2️⃣ Agendar horário\n3️⃣ Ver preços\n4️⃣ Horário de funcionamento\n5️⃣ Nossa localização\n6️⃣ Visite nosso site 🌐\n7️⃣ Mudar idioma 🗣️\n\nResponda com um *número* ou escreva sua pergunta!`,
    hi: (biz) => `${biz} में आपका स्वागत है! 👋\n\nआज मैं आपकी कैसे मदद कर सकता हूं?\n\n1️⃣ हमारी सेवाएं देखें\n2️⃣ अपॉइंटमेंट बुक करें\n3️⃣ कीमतें देखें\n4️⃣ खुलने का समय\n5️⃣ हमारा पता\n6️⃣ हमारी वेबसाइट देखें 🌐\n7️⃣ भाषा बदलें 🗣️\n\n*नंबर* से जवाब दें या अपना सवाल लिखें!`,
    zh: (biz) => `欢迎来到 ${biz}！👋\n\n今天我能帮您什么？\n\n1️⃣ 查看服务\n2️⃣ 预约\n3️⃣ 查看价格\n4️⃣ 营业时间\n5️⃣ 我们的地址\n6️⃣ 访问我们的网站 🌐\n7️⃣ 更换语言 🗣️\n\n请回复*数字*或输入您的问题！`,
    it: (biz) => `Benvenuto da ${biz}! 👋\n\nCome posso aiutarti oggi?\n\n1️⃣ Vedi i nostri servizi\n2️⃣ Prenota un appuntamento\n3️⃣ Vedi i prezzi\n4️⃣ Orari di apertura\n5️⃣ La nostra posizione\n6️⃣ Visita il nostro sito web 🌐\n7️⃣ Cambia lingua 🗣️\n\nRispondi con un *numero* o scrivi la tua domanda!`,
  },
  lang_menu: {
    en: `🌐 Choose your language:\n\n1. English\n2. العربية (Arabic)\n3. Français (French)\n4. Español (Spanish)\n5. Português (Portuguese)\n6. हिन्दी (Hindi)\n7. 中文 (Chinese)\n8. Italiano (Italian)\n\nReply with a number:`,
    ar: `🌐 اختر لغتك:\n\n1. English\n2. العربية (Arabic)\n3. Français (French)\n4. Español (Spanish)\n5. Português (Portuguese)\n6. हिन्दी (Hindi)\n7. 中文 (Chinese)\n8. Italiano (Italian)\n\nأرسل رقم:`,
    fr: `🌐 Choisissez votre langue:\n\n1. English\n2. العربية (Arabic)\n3. Français (French)\n4. Español (Spanish)\n5. Português (Portuguese)\n6. हिन्दी (Hindi)\n7. 中文 (Chinese)\n8. Italiano (Italian)\n\nRépondez avec un numéro:`,
    es: `🌐 Elige tu idioma:\n\n1. English\n2. العربية (Arabic)\n3. Français (French)\n4. Español (Spanish)\n5. Português (Portuguese)\n6. हिन्दी (Hindi)\n7. 中文 (Chinese)\n8. Italiano (Italian)\n\nResponde con un número:`,
    pt: `🌐 Escolha seu idioma:\n\n1. English\n2. العربية (Arabic)\n3. Français (French)\n4. Español (Spanish)\n5. Português (Portuguese)\n6. हिन्दी (Hindi)\n7. 中文 (Chinese)\n8. Italiano (Italian)\n\nResponda com um número:`,
    hi: `🌐 अपनी भाषा चुनें:\n\n1. English\n2. العربية (Arabic)\n3. Français (French)\n4. Español (Spanish)\n5. Português (Portuguese)\n6. हिन्दी (Hindi)\n7. 中文 (Chinese)\n8. Italiano (Italian)\n\nनंबर से जवाब दें:`,
    zh: `🌐 选择您的语言:\n\n1. English\n2. العربية (Arabic)\n3. Français (French)\n4. Español (Spanish)\n5. Português (Portuguese)\n6. हिन्दी (Hindi)\n7. 中文 (Chinese)\n8. Italiano (Italian)\n\n请回复数字:`,
    it: `🌐 Scegli la tua lingua:\n\n1. English\n2. العربية (Arabic)\n3. Français (French)\n4. Español (Spanish)\n5. Português (Portuguese)\n6. हिन्दी (Hindi)\n7. 中文 (Chinese)\n8. Italiano (Italian)\n\nRispondi con un numero:`,
  },
  lang_set: {
    en: () => `✅ Language set to English!\n\nLet me show you the menu:`,
    ar: () => `✅ تم تعيين اللغة إلى العربية!\n\nإليك القائمة:`,
    fr: () => `✅ Langue définie sur Français!\n\nVoici le menu:`,
    es: () => `✅ ¡Idioma cambiado a Español!\n\nAquí está el menú:`,
    pt: () => `✅ Idioma definido para Português!\n\nAqui está o menu:`,
    hi: () => `✅ भाषा हिन्दी में बदली गई!\n\nयहाँ मेनू है:`,
    zh: () => `✅ 语言已设置为中文!\n\n这是菜单:`,
    it: () => `✅ Lingua impostata su Italiano!\n\nEcco il menu:`,
  },
  services_header: {
    en: (biz) => `Here are our services at ${biz}:\n\n`,
    ar: (biz) => `إليك خدماتنا في ${biz}:\n\n`,
    fr: (biz) => `Voici nos services chez ${biz}:\n\n`,
    es: (biz) => `Estos son nuestros servicios en ${biz}:\n\n`,
    pt: (biz) => `Aqui estão nossos serviços em ${biz}:\n\n`,
    hi: (biz) => `${biz} में हमारी सेवाएं:\n\n`,
    zh: (biz) => `${biz} 的服务项目:\n\n`,
    it: (biz) => `Ecco i nostri servizi da ${biz}:\n\n`,
  },
  book_header: {
    en: (biz) => `Let's book an appointment at ${biz}! 📅\n\nChoose a service:\n\n`,
    ar: (biz) => `لنحجز موعد في ${biz}! 📅\n\nاختر خدمة:\n\n`,
    fr: (biz) => `Prenons rendez-vous chez ${biz}! 📅\n\nChoisissez un service:\n\n`,
    es: (biz) => `¡Reservemos una cita en ${biz}! 📅\n\nElige un servicio:\n\n`,
    pt: (biz) => `Vamos agendar em ${biz}! 📅\n\nEscolha um serviço:\n\n`,
    hi: (biz) => `${biz} में अपॉइंटमेंट बुक करें! 📅\n\nसेवा चुनें:\n\n`,
    zh: (biz) => `在 ${biz} 预约吧！📅\n\n选择一项服务:\n\n`,
    it: (biz) => `Prenotiamo da ${biz}! 📅\n\nScegli un servizio:\n\n`,
  },
  reply_number: {
    en: `\n\nReply with the *number* of the service you'd like.\n\nOr reply *No* to go back.`,
    ar: `\n\nأرسل *رقم* الخدمة التي تريدها.\n\nأو أرسل *لا* للعودة.`,
    fr: `\n\nRépondez avec le *numéro* du service souhaité.\n\nOu répondez *Non* pour revenir.`,
    es: `\n\nResponde con el *número* del servicio que deseas.\n\nO responde *No* para volver.`,
    pt: `\n\nResponda com o *número* do serviço desejado.\n\nOu responda *Não* para voltar.`,
    hi: `\n\nजो सेवा चाहिए उसका *नंबर* भेजें।\n\nया वापस जाने के लिए *नहीं* भेजें।`,
    zh: `\n\n请回复您想要的服务*编号*。\n\n或回复*不*返回。`,
    it: `\n\nRispondi con il *numero* del servizio desiderato.\n\nOppure rispondi *No* per tornare indietro.`,
  },
  you_selected: {
    en: (s) => `You selected:\n\n📋 ${s}\n\nWould you like to book this service?\n\nReply *Yes* or *No*`,
    ar: (s) => `لقد اخترت:\n\n📋 ${s}\n\nهل تريد حجز هذه الخدمة؟\n\nأرسل *نعم* أو *لا*`,
    fr: (s) => `Vous avez choisi:\n\n📋 ${s}\n\nVoulez-vous réserver ce service?\n\nRépondez *Oui* ou *Non*`,
    es: (s) => `Has elegido:\n\n📋 ${s}\n\n¿Quieres reservar este servicio?\n\nResponde *Sí* o *No*`,
    pt: (s) => `Você escolheu:\n\n📋 ${s}\n\nGostaria de agendar este serviço?\n\nResponda *Sim* ou *Não*`,
    hi: (s) => `आपने चुना:\n\n📋 ${s}\n\nक्या आप इस सेवा को बुक करना चाहते हैं?\n\n*हाँ* या *नहीं* भेजें`,
    zh: (s) => `您选择了:\n\n📋 ${s}\n\n是否预约此服务？\n\n回复*是*或*否*`,
    it: (s) => `Hai scelto:\n\n📋 ${s}\n\nVuoi prenotare questo servizio?\n\nRispondi *Sì* o *No*`,
  },
  not_found_service: {
    en: `I didn't find that service. Please reply with the *number* from the list above.\n\nOr reply *No* to go back to the menu.`,
    ar: `لم أجد هذه الخدمة. أرسل *رقم* من القائمة أعلاه.\n\nأو أرسل *لا* للعودة.`,
    fr: `Je n'ai pas trouvé ce service. Répondez avec le *numéro* de la liste.\n\nOu répondez *Non* pour revenir.`,
    es: `No encontré ese servicio. Responde con el *número* de la lista.\n\nO responde *No* para volver.`,
    pt: `Não encontrei esse serviço. Responda com o *número* da lista.\n\nOu responda *Não* para voltar.`,
    hi: `यह सेवा नहीं मिली। कृपया ऊपर की सूची से *नंबर* भेजें।\n\nया वापस जाने के लिए *नहीं* भेजें।`,
    zh: `没有找到该服务。请回复列表中的*编号*。\n\n或回复*不*返回菜单。`,
    it: `Non ho trovato quel servizio. Rispondi con il *numero* dalla lista.\n\nOppure rispondi *No* per tornare indietro.`,
  },
  ask_name: {
    en: `Great! 📝\n\nPlease type your *full name*:`,
    ar: `ممتاز! 📝\n\nاكتب *اسمك الكامل*:`,
    fr: `Parfait! 📝\n\nVeuillez écrire votre *nom complet*:`,
    es: `¡Genial! 📝\n\nEscribe tu *nombre completo*:`,
    pt: `Ótimo! 📝\n\nDigite seu *nome completo*:`,
    hi: `बढ़िया! 📝\n\nकृपया अपना *पूरा नाम* लिखें:`,
    zh: `好的！📝\n\n请输入您的*全名*:`,
    it: `Perfetto! 📝\n\nScrivi il tuo *nome completo*:`,
  },
  ask_date: {
    en: (name) => `Thanks ${name}! 👋\n\nPlease type your *preferred date and time*.\n\nExample: 16/5/2026 2:30pm`,
    ar: (name) => `شكراً ${name}! 👋\n\nاكتب *التاريخ والوقت* المفضل.\n\nمثال: 16/5/2026 2:30pm`,
    fr: (name) => `Merci ${name}! 👋\n\nVeuillez écrire la *date et l'heure* souhaitées.\n\nExemple: 16/5/2026 14h30`,
    es: (name) => `¡Gracias ${name}! 👋\n\nEscribe la *fecha y hora* que prefieras.\n\nEjemplo: 16/5/2026 2:30pm`,
    pt: (name) => `Obrigado ${name}! 👋\n\nDigite a *data e horário* desejados.\n\nExemplo: 16/5/2026 14:30`,
    hi: (name) => `धन्यवाद ${name}! 👋\n\nकृपया *तारीख और समय* लिखें।\n\nउदाहरण: 16/5/2026 2:30pm`,
    zh: (name) => `谢谢 ${name}！👋\n\n请输入您*首选的日期和时间*。\n\n例如: 16/5/2026 2:30pm`,
    it: (name) => `Grazie ${name}! 👋\n\nScrivi la *data e l'ora* preferite.\n\nEsempio: 16/5/2026 14:30`,
  },
  confirm_booking: {
    en: (svc, name, dt, biz) => `Please confirm your booking:\n\n📋 Service: ${svc}\n👤 Name: ${name}\n📅 Date/Time: ${dt}\n🏥 At: ${biz}\n\nIs this correct?\n\nReply *Yes* to confirm or *No* to cancel`,
    ar: (svc, name, dt, biz) => `أكد حجزك:\n\n📋 الخدمة: ${svc}\n👤 الاسم: ${name}\n📅 التاريخ/الوقت: ${dt}\n🏥 في: ${biz}\n\nهل هذا صحيح?\n\nأرسل *نعم* للتأكيد أو *لا* للإلغاء`,
    fr: (svc, name, dt, biz) => `Confirmez votre rendez-vous:\n\n📋 Service: ${svc}\n👤 Nom: ${name}\n📅 Date/Heure: ${dt}\n🏥 Chez: ${biz}\n\nEst-ce correct?\n\nRépondez *Oui* pour confirmer ou *Non* pour annuler`,
    es: (svc, name, dt, biz) => `Confirma tu reserva:\n\n📋 Servicio: ${svc}\n👤 Nombre: ${name}\n📅 Fecha/Hora: ${dt}\n🏥 En: ${biz}\n\n¿Es correcto?\n\nResponde *Sí* para confirmar o *No* para cancelar`,
    pt: (svc, name, dt, biz) => `Confirme seu agendamento:\n\n📋 Serviço: ${svc}\n👤 Nome: ${name}\n📅 Data/Hora: ${dt}\n🏥 Em: ${biz}\n\nEstá correto?\n\nResponda *Sim* para confirmar ou *Não* para cancelar`,
    hi: (svc, name, dt, biz) => `अपनी बुकिंग की पुष्टि करें:\n\n📋 सेवा: ${svc}\n👤 नाम: ${name}\n📅 तारीख/समय: ${dt}\n🏥 स्थान: ${biz}\n\nक्या यह सही है?\n\n*हाँ* भेजें पुष्टि के लिए या *नहीं* रद्द करने के लिए`,
    zh: (svc, name, dt, biz) => `请确认您的预约:\n\n📋 服务: ${svc}\n👤 姓名: ${name}\n📅 日期/时间: ${dt}\n🏥 地点: ${biz}\n\n信息正确吗？\n\n回复*是*确认或*否*取消`,
    it: (svc, name, dt, biz) => `Conferma la prenotazione:\n\n📋 Servizio: ${svc}\n👤 Nome: ${name}\n📅 Data/Ora: ${dt}\n🏥 Presso: ${biz}\n\nÈ corretto?\n\nRispondi *Sì* per confermare o *No* per annullare`,
  },
  booking_confirmed: {
    en: (svc, name, dt, biz) => `✅ Booking Confirmed!\n\n📋 ${svc}\n👤 ${name}\n📅 ${dt}\n🏥 ${biz}\n\nThank you! Your appointment has been saved. We'll see you then. 😊\n\nNeed anything else? Just send a message anytime!`,
    ar: (svc, name, dt, biz) => `✅ تم تأكيد الحجز!\n\n📋 ${svc}\n👤 ${name}\n📅 ${dt}\n🏥 ${biz}\n\nشكراً! تم حفظ موعدك. نراك قريباً. 😊\n\nتحتاج شيء آخر؟ أرسل رسالة في أي وقت!`,
    fr: (svc, name, dt, biz) => `✅ Rendez-vous confirmé!\n\n📋 ${svc}\n👤 ${name}\n📅 ${dt}\n🏥 ${biz}\n\nMerci! Votre rendez-vous est enregistré. À bientôt! 😊\n\nBesoin d'autre chose? Envoyez un message à tout moment!`,
    es: (svc, name, dt, biz) => `✅ ¡Reserva confirmada!\n\n📋 ${svc}\n👤 ${name}\n📅 ${dt}\n🏥 ${biz}\n\n¡Gracias! Tu cita ha sido guardada. ¡Nos vemos! 😊\n\n¿Necesitas algo más? ¡Envía un mensaje cuando quieras!`,
    pt: (svc, name, dt, biz) => `✅ Agendamento confirmado!\n\n📋 ${svc}\n👤 ${name}\n📅 ${dt}\n🏥 ${biz}\n\nObrigado! Seu horário foi salvo. Até lá! 😊\n\nPrecisa de mais alguma coisa? Envie uma mensagem a qualquer momento!`,
    hi: (svc, name, dt, biz) => `✅ बुकिंग की पुष्टि हो गई!\n\n📋 ${svc}\n👤 ${name}\n📅 ${dt}\n🏥 ${biz}\n\nधन्यवाद! आपकी अपॉइंटमेंट सेव हो गई। मिलते हैं! 😊\n\nकुछ और चाहिए? कभी भी मैसेज करें!`,
    zh: (svc, name, dt, biz) => `✅ 预约已确认！\n\n📋 ${svc}\n👤 ${name}\n📅 ${dt}\n🏥 ${biz}\n\n谢谢！您的预约已保存。到时见！😊\n\n还需要其他帮助吗？随时发消息！`,
    it: (svc, name, dt, biz) => `✅ Prenotazione confermata!\n\n📋 ${svc}\n👤 ${name}\n📅 ${dt}\n🏥 ${biz}\n\nGrazie! Il tuo appuntamento è stato salvato. A presto! 😊\n\nHai bisogno di altro? Scrivi quando vuoi!`,
  },
  booking_cancelled: {
    en: `No problem! Your booking was not made.\n\nWould you like to start over? Just send a message anytime!`,
    ar: `لا مشكلة! لم يتم الحجز.\n\nتريد البدء من جديد؟ أرسل رسالة في أي وقت!`,
    fr: `Pas de problème! La réservation n'a pas été faite.\n\nVous voulez recommencer? Envoyez un message à tout moment!`,
    es: `¡No hay problema! No se hizo la reserva.\n\n¿Quieres empezar de nuevo? ¡Envía un mensaje cuando quieras!`,
    pt: `Sem problemas! O agendamento não foi feito.\n\nQuer começar de novo? Envie uma mensagem a qualquer momento!`,
    hi: `कोई बात नहीं! बुकिंग नहीं की गई।\n\nफिर से शुरू करना चाहते हैं? कभी भी मैसेज करें!`,
    zh: `没问题！预约未创建。\n\n想重新开始吗？随时发消息！`,
    it: `Nessun problema! La prenotazione non è stata effettuata.\n\nVuoi ricominciare? Scrivi quando vuoi!`,
  },
  slot_taken: {
    en: (next) => `⚠️ Sorry, that time slot is already booked!\n\nThe next available slot is at *${next}*.\n\nPlease type a new date and time:`,
    ar: (next) => `⚠️ عذراً، هذا الموعد محجوز بالفعل!\n\nأقرب موعد متاح هو *${next}*.\n\nيرجى كتابة تاريخ ووقت جديد:`,
    fr: (next) => `⚠️ Désolé, ce créneau est déjà réservé!\n\nLe prochain créneau disponible est à *${next}*.\n\nVeuillez indiquer une nouvelle date et heure:`,
    es: (next) => `⚠️ Lo siento, ese horario ya está reservado!\n\nEl próximo horario disponible es a las *${next}*.\n\nPor favor escribe una nueva fecha y hora:`,
    pt: (next) => `⚠️ Desculpe, esse horário já está reservado!\n\nO próximo horário disponível é às *${next}*.\n\nPor favor digite uma nova data e hora:`,
    hi: (next) => `⚠️ क्षमा करें, वह समय पहले से बुक है!\n\nअगला उपलब्ध समय *${next}* है।\n\nकृपया नई तारीख और समय लिखें:`,
    zh: (next) => `⚠️ 抱歉，该时段已被预约！\n\n下一个可用时段是 *${next}*。\n\n请输入新的日期和时间：`,
    it: (next) => `⚠️ Spiacente, quell'orario è già prenotato!\n\nIl prossimo orario disponibile è alle *${next}*.\n\nScrivi una nuova data e ora:`,
  },
  prices_header: {
    en: (biz) => `💰 Prices at ${biz}:\n\n`,
    ar: (biz) => `💰 الأسعار في ${biz}:\n\n`,
    fr: (biz) => `💰 Tarifs chez ${biz}:\n\n`,
    es: (biz) => `💰 Precios en ${biz}:\n\n`,
    pt: (biz) => `💰 Preços em ${biz}:\n\n`,
    hi: (biz) => `💰 ${biz} की कीमतें:\n\n`,
    zh: (biz) => `💰 ${biz} 的价格:\n\n`,
    it: (biz) => `💰 Prezzi da ${biz}:\n\n`,
  },
  want_to_book: {
    en: `\n\nWould you like to book any of these?\n\nReply *Yes* or *No*`,
    ar: `\n\nهل تريد حجز أي من هذه الخدمات?\n\nأرسل *نعم* أو *لا*`,
    fr: `\n\nVoulez-vous réserver l'un de ces services?\n\nRépondez *Oui* ou *Non*`,
    es: `\n\n¿Quieres reservar alguno de estos?\n\nResponde *Sí* o *No*`,
    pt: `\n\nGostaria de agendar algum destes?\n\nResponda *Sim* ou *Não*`,
    hi: `\n\nक्या आप इनमें से कुछ बुक करना चाहते हैं?\n\n*हाँ* या *नहीं* भेजें`,
    zh: `\n\n是否要预约其中之一？\n\n回复*是*或*否*`,
    it: `\n\nVuoi prenotare uno di questi?\n\nRispondi *Sì* o *No*`,
  },
  hours_header: {
    en: (biz) => `🕐 Opening hours at ${biz}:\n\n`,
    ar: (biz) => `🕐 ساعات العمل في ${biz}:\n\n`,
    fr: (biz) => `🕐 Horaires d'ouverture chez ${biz}:\n\n`,
    es: (biz) => `🕐 Horario de ${biz}:\n\n`,
    pt: (biz) => `🕐 Horário de ${biz}:\n\n`,
    hi: (biz) => `🕐 ${biz} का समय:\n\n`,
    zh: (biz) => `🕐 ${biz} 的营业时间:\n\n`,
    it: (biz) => `🕐 Orari di ${biz}:\n\n`,
  },
  location_header: {
    en: `📍 Find us at:\n`,
    ar: `📍 تجدنا في:\n`,
    fr: `📍 Retrouvez-nous à:\n`,
    es: `📍 Encuéntranos en:\n`,
    pt: `📍 Nos encontre em:\n`,
    hi: `📍 हमारा पता:\n`,
    zh: `📍 地址:\n`,
    it: `📍 Ci trovi a:\n`,
  },
  no_services: {
    en: `We haven't listed our services yet. Please contact us directly!`,
    ar: `لم يتم إدراج خدماتنا بعد. تواصل معنا مباشرة!`,
    fr: `Nos services ne sont pas encore listés. Contactez-nous directement!`,
    es: `Aún no hemos listado nuestros servicios. ¡Contáctanos directamente!`,
    pt: `Nossos serviços ainda não foram listados. Entre em contato diretamente!`,
    hi: `हमारी सेवाएं अभी सूचीबद्ध नहीं हैं। सीधे संपर्क करें!`,
    zh: `我们的服务尚未列出。请直接联系我们！`,
    it: `I nostri servizi non sono ancora elencati. Contattaci direttamente!`,
  },
  no_hours: {
    en: `Our opening hours are not set yet. Please contact us directly!`,
    ar: `لم يتم تعيين ساعات العمل بعد. تواصل معنا مباشرة!`,
    fr: `Nos horaires ne sont pas encore définis. Contactez-nous directement!`,
    es: `Nuestro horario aún no está definido. ¡Contáctanos directamente!`,
    pt: `Nosso horário ainda não foi definido. Entre em contato diretamente!`,
    hi: `हमारे समय की जानकारी अभी उपलब्ध नहीं है। सीधे संपर्क करें!`,
    zh: `我们的营业时间尚未设置。请直接联系我们！`,
    it: `I nostri orari non sono ancora impostati. Contattaci direttamente!`,
  },
  no_location: {
    en: `Our location details are not set yet. Please contact us directly!`,
    ar: `لم يتم تعيين تفاصيل الموقع بعد. تواصل معنا مباشرة!`,
    fr: `Notre adresse n'est pas encore définie. Contactez-nous directement!`,
    es: `Nuestra ubicación aún no está definida. ¡Contáctanos directamente!`,
    pt: `Nosso endereço ainda não foi definido. Entre em contato diretamente!`,
    hi: `हमारे पते की जानकारी अभी उपलब्ध नहीं है। सीधे संपर्क करें!`,
    zh: `我们的地址尚未设置。请直接联系我们！`,
    it: `Il nostro indirizzo non è ancora impostato. Contattaci direttamente!`,
  },
  website_msg: {
    en: (biz, url) => `🌐 Visit ${biz} online:\n\n${url}\n\nNeed anything else? Just send a message!`,
    ar: (biz, url) => `🌐 زوروا ${biz} عبر الإنترنت:\n\n${url}\n\nتحتاج شيء آخر؟ أرسل رسالة!`,
    fr: (biz, url) => `🌐 Visitez ${biz} en ligne:\n\n${url}\n\nBesoin d'autre chose? Envoyez un message!`,
    es: (biz, url) => `🌐 Visita ${biz} en linea:\n\n${url}\n\nNecesitas algo mas? Envia un mensaje!`,
    pt: (biz, url) => `🌐 Visite ${biz} online:\n\n${url}\n\nPrecisa de mais alguma coisa? Envie uma mensagem!`,
    hi: (biz, url) => `🌐 ${biz} की वेबसाइट देखें:\n\n${url}\n\nकुछ और चाहिए? मैसेज करें!`,
    zh: (biz, url) => `🌐 访问 ${biz} 的网站:\n\n${url}\n\n还需要帮助吗？发消息就行！`,
    it: (biz, url) => `🌐 Visita ${biz} online:\n\n${url}\n\nHai bisogno di altro? Scrivi un messaggio!`,
  },
  no_website: {
    en: `Our website is not set up yet. Please contact us directly for more information!`,
    ar: `لم يتم إعداد موقعنا الإلكتروني بعد. تواصل معنا مباشرة لمزيد من المعلومات!`,
    fr: `Notre site web n'est pas encore configuré. Contactez-nous directement pour plus d'informations!`,
    es: `Nuestro sitio web aún no está configurado. ¡Contáctanos directamente para más información!`,
    pt: `Nosso site ainda não está configurado. Entre em contato diretamente para mais informações!`,
    hi: `हमारी वेबसाइट अभी सेट नहीं है। अधिक जानकारी के लिए सीधे संपर्क करें!`,
    zh: `我们的网站尚未设置。请直接联系我们获取更多信息！`,
    it: `Il nostro sito web non è ancora configurato. Contattaci direttamente per maggiori informazioni!`,
  },
  thanks: {
    en: `You're welcome! 😊\n\nNeed anything else? Just send a message anytime!`,
    ar: `عفواً! 😊\n\nتحتاج شيء آخر؟ أرسل رسالة في أي وقت!`,
    fr: `De rien! 😊\n\nBesoin d'autre chose? Envoyez un message à tout moment!`,
    es: `¡De nada! 😊\n\n¿Necesitas algo más? ¡Envía un mensaje cuando quieras!`,
    pt: `De nada! 😊\n\nPrecisa de mais alguma coisa? Envie uma mensagem a qualquer momento!`,
    hi: `आपका स्वागत है! 😊\n\nकुछ और चाहिए? कभी भी मैसेज करें!`,
    zh: `不客气！😊\n\n还需要其他帮助吗？随时发消息！`,
    it: `Prego! 😊\n\nHai bisogno di altro? Scrivi quando vuoi!`,
  },
  yes_or_no: {
    en: `Please reply *Yes* to book or *No* to go back.`,
    ar: `أرسل *نعم* للحجز أو *لا* للعودة.`,
    fr: `Répondez *Oui* pour réserver ou *Non* pour revenir.`,
    es: `Responde *Sí* para reservar o *No* para volver.`,
    pt: `Responda *Sim* para agendar ou *Não* para voltar.`,
    hi: `बुक करने के लिए *हाँ* या वापस जाने के लिए *नहीं* भेजें।`,
    zh: `回复*是*预约或*否*返回。`,
    it: `Rispondi *Sì* per prenotare o *No* per tornare indietro.`,
  },
  type_name: {
    en: `Please type your full name.\n\nOr reply *No* to cancel.`,
    ar: `اكتب اسمك الكامل.\n\nأو أرسل *لا* للإلغاء.`,
    fr: `Écrivez votre nom complet.\n\nOu répondez *Non* pour annuler.`,
    es: `Escribe tu nombre completo.\n\nO responde *No* para cancelar.`,
    pt: `Digite seu nome completo.\n\nOu responda *Não* para cancelar.`,
    hi: `अपना पूरा नाम लिखें।\n\nया रद्द करने के लिए *नहीं* भेजें।`,
    zh: `请输入您的全名。\n\n或回复*不*取消。`,
    it: `Scrivi il tuo nome completo.\n\nO rispondi *No* per annullare.`,
  },
  type_date: {
    en: `Please type your preferred date and time.\n\nExample: Tomorrow 3pm\n\nOr reply *No* to cancel.`,
    ar: `اكتب التاريخ والوقت المفضل.\n\nمثال: غداً 3pm\n\nأو أرسل *لا* للإلغاء.`,
    fr: `Écrivez la date et l'heure souhaitées.\n\nExemple: Demain 15h\n\nOu répondez *Non* pour annuler.`,
    es: `Escribe la fecha y hora que prefieras.\n\nEjemplo: Mañana 3pm\n\nO responde *No* para cancelar.`,
    pt: `Digite a data e horário desejados.\n\nExemplo: Amanhã 15h\n\nOu responda *Não* para cancelar.`,
    hi: `तारीख और समय लिखें।\n\nउदाहरण: कल 3pm\n\nया रद्द करने के लिए *नहीं* भेजें।`,
    zh: `请输入首选日期和时间。\n\n例如: 明天下午3点\n\n或回复*不*取消。`,
    it: `Scrivi la data e l'ora preferite.\n\nEsempio: Domani 15:00\n\nO rispondi *No* per annullare.`,
  },
  confirm_yes_no: {
    en: `Please reply *Yes* to confirm your booking or *No* to cancel.`,
    ar: `أرسل *نعم* لتأكيد الحجز أو *لا* للإلغاء.`,
    fr: `Répondez *Oui* pour confirmer ou *Non* pour annuler.`,
    es: `Responde *Sí* para confirmar o *No* para cancelar.`,
    pt: `Responda *Sim* para confirmar ou *Não* para cancelar.`,
    hi: `बुकिंग की पुष्टि के लिए *हाँ* या रद्द करने के लिए *नहीं* भेजें।`,
    zh: `回复*是*确认预约或*否*取消。`,
    it: `Rispondi *Sì* per confermare o *No* per annullare.`,
  },
  invalid_time: {
    en: (reason) => `⚠️ ${reason}\n\nPlease type a new *date and time*.\n\nExample: 16/5/2026 2:30pm\n\nOr reply *No* to cancel.`,
    ar: (reason) => `⚠️ ${reason}\n\nاكتب *تاريخ ووقت* جديد.\n\nمثال: 16/5/2026 2:30pm\n\nأو أرسل *لا* للإلغاء.`,
    fr: (reason) => `⚠️ ${reason}\n\nÉcrivez une nouvelle *date et heure*.\n\nExemple: 16/5/2026 14h30\n\nOu répondez *Non* pour annuler.`,
    es: (reason) => `⚠️ ${reason}\n\nEscribe una nueva *fecha y hora*.\n\nEjemplo: 16/5/2026 2:30pm\n\nO responde *No* para cancelar.`,
    pt: (reason) => `⚠️ ${reason}\n\nDigite nova *data e horário*.\n\nExemplo: 16/5/2026 14:30\n\nOu responda *Não* para cancelar.`,
    hi: (reason) => `⚠️ ${reason}\n\nनई *तारीख और समय* लिखें।\n\nउदाहरण: 16/5/2026 2:30pm\n\nया रद्द करने के लिए *नहीं* भेजें।`,
    zh: (reason) => `⚠️ ${reason}\n\n请输入新的*日期和时间*。\n\n例如: 16/5/2026 2:30pm\n\n或回复*不*取消。`,
    it: (reason) => `⚠️ ${reason}\n\nScrivi una nuova *data e ora*.\n\nEsempio: 16/5/2026 14:30\n\nO rispondi *No* per annullare.`,
  },
  cancel_reschedule: {
    en: `To cancel or reschedule, please provide:\n\n1. Your name\n2. Date of your appointment\n\nWe'll sort it out for you!`,
    ar: `لإلغاء أو تغيير الموعد، أرسل:\n\n1. اسمك\n2. تاريخ موعدك\n\nسنساعدك!`,
    fr: `Pour annuler ou modifier, veuillez fournir:\n\n1. Votre nom\n2. La date de votre rendez-vous\n\nNous nous en occupons!`,
    es: `Para cancelar o reprogramar, proporciona:\n\n1. Tu nombre\n2. Fecha de tu cita\n\n¡Lo resolveremos!`,
    pt: `Para cancelar ou reagendar, forneça:\n\n1. Seu nome\n2. Data do seu agendamento\n\nVamos resolver!`,
    hi: `रद्द या बदलने के लिए भेजें:\n\n1. आपका नाम\n2. अपॉइंटमेंट की तारीख\n\nहम मदद करेंगे!`,
    zh: `要取消或改期，请提供:\n\n1. 您的姓名\n2. 预约日期\n\n我们会为您处理！`,
    it: `Per cancellare o riprogrammare, fornisci:\n\n1. Il tuo nome\n2. La data dell'appuntamento\n\nCi pensiamo noi!`,
  },
}

function tr(key, lang, ...args) {
  const entry = T[key]
  if (!entry) return ''
  const fn = entry[lang] || entry['en']
  if (typeof fn === 'function') return fn(...args)
  return fn || entry['en'] || ''
}

// ── Language detection ──
const LANG_NUM_MAP = { '1': 'en', '2': 'ar', '3': 'fr', '4': 'es', '5': 'pt', '6': 'hi', '7': 'zh', '8': 'it' }

function detectLanguage(text) {
  const lo = text.toLowerCase().trim()
  if (/[؀-ۿ]/.test(text)) return 'ar'
  if (/[ऀ-ॿ]/.test(text)) return 'hi'
  if (/[一-鿿]/.test(text)) return 'zh'
  if (/^(bonjour|salut|bonsoir|merci|oui|non|rendez|comment)/.test(lo)) return 'fr'
  if (/^(hola|buenos|buenas|gracias|sí|cita|quiero)/.test(lo)) return 'es'
  if (/^(olá|oi|bom dia|obrigad|quero|agendar)/.test(lo)) return 'pt'
  if (/^(buongiorno|ciao|grazie|buonasera|vorrei|prenotare)/.test(lo)) return 'it'
  return 'en'
}

// ── Fetch business data (DB-first approach) ──

async function fetchBusinessData(supabaseUrl, supabaseKey, businessId) {
  const data = {}

  // Always fetch from database first (this is where the app saves data)
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
      if (rows[0]) data.business_info = rows[0]
    }
  } catch (err) {
    console.error('[WA] Error fetching business:', err.message)
  }

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
  } catch (err) {
    console.error('[WA] Error fetching services:', err.message)
  }

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
  } catch (err) {
    console.error('[WA] Error fetching schedule:', err.message)
  }

  return data
}

// ── Persistent conversation state (survives restarts) ──
const STATE_DIR = process.env.STATE_DIR || '/opt/solis-whatsapp/state'
if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true })

const CONV_FILE = path.join(STATE_DIR, 'conversations.json')
const LANG_FILE = path.join(STATE_DIR, 'languages.json')
const CONV_TIMEOUT = 30 * 60 * 1000

let conversations = new Map()
let userLangs = new Map()

function loadState() {
  try {
    if (fs.existsSync(CONV_FILE)) {
      const raw = JSON.parse(fs.readFileSync(CONV_FILE, 'utf8'))
      conversations = new Map(Object.entries(raw))
    }
  } catch {}
  try {
    if (fs.existsSync(LANG_FILE)) {
      const raw = JSON.parse(fs.readFileSync(LANG_FILE, 'utf8'))
      userLangs = new Map(Object.entries(raw))
    }
  } catch {}
}

let _saveTimer = null
function saveState() {
  if (_saveTimer) return
  _saveTimer = setTimeout(() => {
    _saveTimer = null
    try {
      const convObj = {}
      for (const [k, v] of conversations) convObj[k] = v
      fs.writeFileSync(CONV_FILE, JSON.stringify(convObj))
    } catch {}
    try {
      const langObj = {}
      for (const [k, v] of userLangs) langObj[k] = v
      fs.writeFileSync(LANG_FILE, JSON.stringify(langObj))
    } catch {}
  }, 500)
}

loadState()

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
  saveState()
}

function clearConv(key) { conversations.delete(key); saveState() }

// ── User language preferences ──
function getUserLang(key) { return userLangs.get(key) || null }
function setUserLang(key, lang) { userLangs.set(key, lang); saveState() }

// ── Helpers ──

function isYes(txt) {
  return /^(yes|yeah|yep|yea|y|sure|ok|okay|oui|si|sí|sim|نعم|اكيد|تمام|da|ja|haan|हाँ|हां|是|1)$/i.test(txt.trim())
}

function isNo(txt) {
  return /^(no|nah|nope|non|لا|nie|nein|não|नहीं|否|不|2)$/i.test(txt.trim())
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
  const txt = text.trim().replace(/[​-‍﻿]/g, '')

  const numMatch = txt.match(/^(\d+)/)
  const num = numMatch ? parseInt(numMatch[1]) : NaN
  if (!isNaN(num) && num >= 1 && num <= services.length) {
    return services[num - 1]
  }

  const lo = txt.toLowerCase()
  for (const s of services) {
    if (!s.name) continue
    if (s.name.toLowerCase() === lo) return s
  }

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
  const s = schedule || biz?.schedule || {}
  if (Object.keys(s).length === 0) return null
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  let lines = ''
  for (const day of days) {
    const d = s[day]
    if (!d) continue
    const isOpen = d.enabled !== false && d.off !== true
    const startTime = d.open || d.start
    const endTime = d.close || d.end
    if (isOpen && startTime) {
      lines += `${day.charAt(0).toUpperCase() + day.slice(1)}: ${startTime} - ${endTime}\n`
    } else {
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

// ── Save booking to Supabase ──

async function checkSlotAvailable(supabaseUrl, supabaseKey, businessId, dateStr, timeStr, duration) {
  try {
    const resp = await fetch(
      `${supabaseUrl}/rest/v1/bookings?business_id=eq.${businessId}&date=eq.${dateStr}&status=neq.cancelled&select=time,duration`,
      {
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
        }
      }
    )
    if (!resp.ok) return { available: true }
    const bookings = await resp.json()
    if (!bookings.length) return { available: true }

    const reqStart = parseInt(timeStr.split(':')[0]) * 60 + parseInt(timeStr.split(':')[1])
    const reqEnd = reqStart + (duration || 30)

    for (const b of bookings) {
      const bStart = parseInt(b.time.split(':')[0]) * 60 + parseInt(b.time.split(':')[1])
      const bEnd = bStart + (b.duration || 30)
      if (reqStart < bEnd && reqEnd > bStart) {
        const nextFree = bEnd
        const nextH = String(Math.floor(nextFree / 60)).padStart(2, '0')
        const nextM = String(nextFree % 60).padStart(2, '0')
        return { available: false, nextSlot: `${nextH}:${nextM}` }
      }
    }
    return { available: true }
  } catch (err) {
    console.error('[WA] Error checking availability:', err.message)
    return { available: true }
  }
}

async function saveBooking(supabaseUrl, supabaseKey, businessId, details) {
  const { date, time } = parseDateTimeStr(details.dateTime)

  const booking = {
    business_id: businessId,
    customer_name: details.customerName,
    customer_phone: details.customerPhone.replace('@s.whatsapp.net', ''),
    service_id: details.serviceId || null,
    date: date,
    time: time,
    duration: details.duration || 30,
    status: 'confirmed',
    notes: 'Booked via WhatsApp AI',
  }

  const resp = await fetch(`${supabaseUrl}/rest/v1/bookings`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseKey}`,
      'apikey': supabaseKey,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify(booking),
  })

  if (!resp.ok) {
    const err = await resp.text()
    throw new Error(`Supabase error: ${resp.status} ${err}`)
  }

  const result = await resp.json()
  console.log(`[BOOKING] Saved booking for ${details.customerName} at ${date} ${time}`)
  return result
}

function parseDateTimeStr(str) {
  const s = str.trim()
  let hasDate = false
  let hasTime = false

  const dateMatch = s.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/)
  let date = null
  if (dateMatch) {
    const day = dateMatch[1].padStart(2, '0')
    const month = dateMatch[2].padStart(2, '0')
    let year = dateMatch[3]
    if (year.length === 2) year = '20' + year
    date = `${year}-${month}-${day}`
    hasDate = true
  } else if (/today|tonight|now|aujourd|hoy|hoje|oggi|اليوم|आज|今天/i.test(s)) {
    date = new Date().toISOString().split('T')[0]
    hasDate = true
  } else if (/tomorrow|demain|mañana|amanhã|domani|غدا|कल|明天/i.test(s)) {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    date = tomorrow.toISOString().split('T')[0]
    hasDate = true
  }

  const timeStr = dateMatch ? s.slice(dateMatch.index + dateMatch[0].length) : s
  const timeMatch = timeStr.match(/(\d{1,2})[:\.](\d{2})\s*(am|pm)?/i) || timeStr.match(/(\d{1,2})\s*(am|pm)/i)
  let time = '09:00:00'
  if (timeMatch) {
    let h = parseInt(timeMatch[1])
    const m = timeMatch[2] && /^\d+$/.test(timeMatch[2]) ? parseInt(timeMatch[2]) : 0
    const ampm = (timeMatch[3] || timeMatch[2] || '').toLowerCase()
    const isPm = ampm === 'pm'
    const isAm = ampm === 'am'
    if (isPm && h < 12) h += 12
    if (isAm && h === 12) h = 0
    time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`
    hasTime = true
  }

  return { date, time, valid: hasDate || hasTime }
}

function validateBookingTime(dateStr, timeStr, schedule) {
  if (!schedule || Object.keys(schedule).length === 0) return { valid: true }

  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

  const parts = dateStr.split('-')
  const dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
  const dayName = dayNames[dateObj.getDay()]
  const daySchedule = schedule[dayName]

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (dateObj < today) {
    return { valid: false, reason: `That date has already passed. Please choose a future date.` }
  }

  const maxDate = new Date(today)
  maxDate.setFullYear(maxDate.getFullYear() + 1)
  if (dateObj > maxDate) {
    return { valid: false, reason: `That date is too far in the future. Please choose a date within the next 12 months.` }
  }

  if (!daySchedule || daySchedule.enabled === false || daySchedule.off === true) {
    const openDays = dayNames.filter(d => {
      const ds = schedule[d]
      return ds && ds.enabled !== false && ds.off !== true
    }).map(d => d.charAt(0).toUpperCase() + d.slice(1))
    return { valid: false, reason: `Sorry, we're closed on ${dayName.charAt(0).toUpperCase() + dayName.slice(1)}.\n\nWe're open on:\n${openDays.join(', ')}\n\nPlease choose another date.` }
  }

  const openTime = daySchedule.open || daySchedule.start || '09:00'
  const closeTime = daySchedule.close || daySchedule.end || '17:00'

  const bookingMinutes = parseInt(timeStr.split(':')[0]) * 60 + parseInt(timeStr.split(':')[1])
  const openMinutes = parseInt(openTime.split(':')[0]) * 60 + parseInt(openTime.split(':')[1] || '0')
  const closeMinutes = parseInt(closeTime.split(':')[0]) * 60 + parseInt(closeTime.split(':')[1] || '0')

  if (bookingMinutes < openMinutes || bookingMinutes >= closeMinutes) {
    return { valid: false, reason: `Sorry, that time is outside our working hours.\n\nOn ${dayName.charAt(0).toUpperCase() + dayName.slice(1)} we're open from ${openTime} to ${closeTime}.\n\nPlease choose a time within these hours.` }
  }

  return { valid: true }
}

// ── Rate limiter ──
const recentReplies = new Map()

// ── Main handler (wrapped in try/catch to prevent crashes) ──

async function handleIncomingMessage({ businessId, senderPhone, senderName, text, sock, jid, supabaseUrl, supabaseKey }) {
  try {
    const replyKey = `${businessId}:${senderPhone}`
    const now = Date.now()
    const lastReply = recentReplies.get(replyKey) || 0
    if (now - lastReply < 800) return
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
    const txt = text.trim()
    const lo = txt.toLowerCase()

    const convKey = replyKey
    const conv = getConv(convKey)

    // Get or detect language
    let lang = getUserLang(convKey)
    if (!lang) {
      lang = detectLanguage(txt)
      setUserLang(convKey, lang)
    }

    console.log(`[MSG] ${businessId} | ${senderPhone} | lang=${lang} | state=${conv?.state || 'none'} | "${txt.slice(0, 60)}"`)

    let reply = ''

    // ── Language change: "7" from menu or keywords ──
    if (/^(7|language|lang|langue|idioma|لغة|भाषा|语言|lingua)$/i.test(txt) && (!conv || conv.state === 'menu' || !conv.state)) {
      reply = tr('lang_menu', lang)
      setConv(convKey, 'choose_lang', { prevLang: lang })
      logMessage(businessId, senderPhone, 'inbound', text, null, senderName)
      await sock.sendMessage(jid, { text: reply })
      logMessage(businessId, senderPhone, 'outbound', reply, null, senderName)
      return
    }

    // ── Handle language selection ──
    if (conv?.state === 'choose_lang') {
      const selectedLang = LANG_NUM_MAP[txt.trim()]
      if (selectedLang) {
        setUserLang(convKey, selectedLang)
        lang = selectedLang
        reply = tr('lang_set', lang) + '\n\n' + tr('welcome', lang, bizName)
        setConv(convKey, 'menu')
      } else if (/^(hi|hello|hey|menu|start|back|0|cancel|no)$/i.test(txt.trim())) {
        reply = tr('welcome', lang, bizName)
        setConv(convKey, 'menu')
      } else {
        reply = tr('lang_menu', lang)
      }
      logMessage(businessId, senderPhone, 'inbound', text, null, senderName)
      await sock.sendMessage(jid, { text: reply })
      logMessage(businessId, senderPhone, 'outbound', reply, null, senderName)
      return
    }

    // ── Global reset: "menu", "start", "restart", "0" ──
    if (/^(menu|start|restart|reset|back|0|main)$/i.test(txt)) {
      reply = tr('welcome', lang, bizName)
      setConv(convKey, 'menu')
      logMessage(businessId, senderPhone, 'inbound', text, null, senderName)
      await sock.sendMessage(jid, { text: reply })
      logMessage(businessId, senderPhone, 'outbound', reply, null, senderName)
      return
    }

    // ── Handle based on conversation state ──
    // Defer state changes until after message is sent successfully
    let pendingState = null // { state, data } or { clear: true }

    if (conv?.state === 'pick_service') {
      const picked = findServiceByInput(txt, services)
      if (picked) {
        pendingState = { state: 'confirm_service', data: { service: picked } }
        reply = tr('you_selected', lang, formatServiceLine(picked))
      } else if (isNo(txt)) {
        reply = tr('welcome', lang, bizName)
        pendingState = { state: 'menu' }
      } else {
        reply = tr('not_found_service', lang)
      }
    }

    else if (conv?.state === 'confirm_service') {
      if (isYes(txt)) {
        pendingState = { state: 'ask_name', data: { service: conv.service } }
        reply = tr('ask_name', lang)
      } else if (isNo(txt)) {
        reply = tr('welcome', lang, bizName)
        pendingState = { state: 'menu' }
      } else {
        reply = tr('yes_or_no', lang)
      }
    }

    else if (conv?.state === 'ask_name') {
      if (isNo(txt)) {
        reply = tr('welcome', lang, bizName)
        pendingState = { state: 'menu' }
      } else if (txt.length >= 2 && /[a-zA-Z؀-ۿऀ-ॿ一-鿿À-ɏ]/.test(txt)) {
        pendingState = { state: 'ask_phone', data: { service: conv.service, name: txt } }
        reply = `Thanks ${txt}! Please enter your phone number (with country code, e.g. +61412345678):`
      } else {
        reply = tr('type_name', lang)
      }
    }

    else if (conv?.state === 'ask_phone') {
      if (isNo(txt)) {
        reply = tr('welcome', lang, bizName)
        pendingState = { state: 'menu' }
      } else {
        const cleanPhone = txt.replace(/[\s\-\(\)]/g, '')
        if (/^\+?\d{8,15}$/.test(cleanPhone)) {
          pendingState = { state: 'ask_date', data: { service: conv.service, name: conv.name, customerPhone: cleanPhone.startsWith('+') ? cleanPhone : '+' + cleanPhone } }
          reply = tr('ask_date', lang, conv.name)
        } else {
          reply = 'Please enter a valid phone number with country code (e.g. +61412345678):'
        }
      }
    }

    else if (conv?.state === 'ask_date') {
      if (isNo(txt)) {
        reply = tr('welcome', lang, bizName)
        pendingState = { state: 'menu' }
      } else {
        const parsed = parseDateTimeStr(txt)
        if (!parsed.valid) {
          reply = tr('type_date', lang)
          pendingState = { state: 'ask_date', data: { service: conv.service, name: conv.name, customerPhone: conv.customerPhone } }
        } else if (!parsed.date) {
          const today = new Date()
          parsed.date = today.toISOString().split('T')[0]
        }
        if (parsed.valid) {
          const scheduleData = schedule?.monday ? schedule : (schedule || {})
          const validation = validateBookingTime(parsed.date, parsed.time, scheduleData)
          if (!validation.valid) {
            reply = tr('invalid_time', lang, validation.reason)
            pendingState = { state: 'ask_date', data: { service: conv.service, name: conv.name, customerPhone: conv.customerPhone } }
          } else {
            pendingState = { state: 'confirm_booking', data: { service: conv.service, name: conv.name, customerPhone: conv.customerPhone, dateTime: txt } }
            reply = tr('confirm_booking', lang, formatServiceLine(conv.service), conv.name, txt, bizName)
          }
        }
      }
    }

    else if (conv?.state === 'confirm_booking') {
      if (isYes(txt)) {
        const parsed = parseDateTimeStr(conv.dateTime)
        const slotCheck = await checkSlotAvailable(supabaseUrl, supabaseKey, businessId, parsed.date, parsed.time, conv.service.duration || 30)
        if (!slotCheck.available) {
          reply = tr('slot_taken', lang, slotCheck.nextSlot)
          pendingState = { state: 'ask_date', data: { service: conv.service, name: conv.name } }
        } else {
          try {
            await saveBooking(supabaseUrl, supabaseKey, businessId, {
              customerName: conv.name,
              customerPhone: conv.customerPhone || senderPhone,
              serviceId: conv.service.id,
              dateTime: conv.dateTime,
              duration: conv.service.duration,
            })
          } catch (err) {
            console.error('Failed to save booking:', err.message)
          }
          pendingState = { clear: true }
          reply = tr('booking_confirmed', lang, formatServiceLine(conv.service), conv.name, conv.dateTime, bizName)
        }
      } else if (isNo(txt)) {
        pendingState = { clear: true }
        reply = tr('booking_cancelled', lang)
      } else {
        reply = tr('confirm_yes_no', lang)
      }
    }

    else if (conv?.state === 'menu' || conv?.state === 'after_prices' || conv?.state === 'after_hours' || conv?.state === 'after_location') {
      if ((conv?.state === 'after_prices' || conv?.state === 'after_hours' || conv?.state === 'after_location') && isYes(txt)) {
        const sResult = showServices(bizName, services, true, lang)
        pendingState = { state: sResult.nextState || 'menu' }
        reply = sResult.text
      } else if (isNo(txt) && conv?.state !== 'menu') {
        reply = tr('welcome', lang, bizName)
        pendingState = { state: 'menu' }
      } else {
        const result = handleMenuChoice(lo, bizName, services, biz, schedule, lang)
        if (result.needsAI) {
          const aiReply = await getAIResponse(txt, convKey, bizName, services, biz, schedule, lang)
          reply = aiReply || tr('welcome', lang, bizName)
        } else {
          reply = result.text
        }
        pendingState = { state: result.nextState || 'menu' }
      }
    }

    // ── No active conversation or fresh message ──
    else {
      const result = handleMenuChoice(lo, bizName, services, biz, schedule, lang)
      if (result.needsAI) {
        const aiReply = await getAIResponse(txt, convKey, bizName, services, biz, schedule, lang)
        reply = aiReply || tr('welcome', lang, bizName)
      } else {
        reply = result.text
      }
      pendingState = { state: result.nextState || 'menu' }
    }

    logMessage(businessId, senderPhone, 'inbound', text, null, senderName)
    await sock.sendMessage(jid, { text: reply })
    logMessage(businessId, senderPhone, 'outbound', reply, null, senderName)
    // Only advance state after message delivered successfully
    if (pendingState) {
      if (pendingState.clear) {
        clearConv(convKey)
      } else {
        setConv(convKey, pendingState.state, pendingState.data)
      }
    }

  } catch (err) {
    console.error(`[WA] HANDLER ERROR for ${businessId}:`, err.message, err.stack)
  }
}

// ── Menu handler ──

function handleMenuChoice(input, bizName, services, biz, schedule, lang) {
  const txt = input.trim()

  if (txt === '1' || /\b(service|services|what do you|what can|offer|menu|list|catalog|خدم|सेव|服务|serviz)\b/.test(txt)) {
    return showServices(bizName, services, false, lang)
  }
  if (txt === '2' || /\b(book|appointment|reserve|schedule|rdv|cita|حجز|rendez|prenot|agend|बुक|预约)\b/.test(txt)) {
    return showServices(bizName, services, true, lang)
  }
  if (txt === '3' || /\b(price|prices|pricing|cost|how much|fee|tarif|prix|سعر|اسعار|كم|precio|prezzo|कीमत|价格)\b/.test(txt)) {
    return showPrices(bizName, services, lang)
  }
  if (txt === '4' || /\b(hour|hours|open|close|opening|closing|when|time|timing|horaire|ساعات|orari|समय|时间)\b/.test(txt)) {
    return showHours(bizName, biz, schedule, lang)
  }
  if (txt === '5' || /\b(where|address|location|direction|map|عنوان|موقع|adresse|direccion|indirizzo|पता|地址)\b/.test(txt)) {
    return showLocation(bizName, biz, lang)
  }
  if (txt === '6' || /\b(website|site|web|sitio|sito|موقع.?إلكتروني|वेबसाइट|网站)\b/.test(txt)) {
    return showWebsite(bizName, biz, lang)
  }
  if (txt === '7' || /\b(language|lang|langue|idioma|لغة|भाषा|语言|lingua)\b/.test(txt)) {
    return { text: tr('lang_menu', lang), nextState: 'choose_lang' }
  }

  if (/^(hi|hello|hey|good morning|good afternoon|good evening|salam|salut|bonjour|hola|مرحبا|اهلا|ciao|oi|olá|नमस्ते|你好)$/i.test(txt) || /\b(hi|hello|hey)\b/.test(txt)) {
    return { text: tr('welcome', lang, bizName) }
  }

  if (/\b(thank|thanks|thx|merci|gracias|شكرا|grazie|obrigad|धन्यवाद|谢谢)\b/.test(txt)) {
    return { text: tr('thanks', lang) }
  }

  if (/\b(cancel|reschedule|annuler|cancelar|الغاء|annullare|cancelar|रद्द|取消)\b/.test(txt)) {
    return { text: tr('cancel_reschedule', lang) }
  }

  if (isYes(txt)) {
    return { text: tr('welcome', lang, bizName) }
  }

  return { text: null, needsAI: true }
}

function showServices(bizName, services, forBooking = false, lang = 'en') {
  const list = formatServiceList(services)
  if (list) {
    const header = forBooking
      ? tr('book_header', lang, bizName)
      : tr('services_header', lang, bizName)
    return {
      text: `${header}${list}${tr('reply_number', lang)}`,
      nextState: 'pick_service'
    }
  }
  return { text: tr('no_services', lang) }
}

function showPrices(bizName, services, lang = 'en') {
  const list = formatServiceList(services)
  if (list) {
    return {
      text: `${tr('prices_header', lang, bizName)}${list}${tr('want_to_book', lang)}`,
      nextState: 'after_prices'
    }
  }
  return { text: tr('no_services', lang) }
}

function showHours(bizName, biz, schedule, lang = 'en') {
  const hours = formatHours(biz, schedule)
  if (hours) {
    return { text: `${tr('hours_header', lang, bizName)}${hours}${tr('want_to_book', lang)}`, nextState: 'after_hours' }
  }
  return { text: tr('no_hours', lang) }
}

function showLocation(bizName, biz, lang = 'en') {
  const loc = formatLocation(biz)
  if (loc) {
    return { text: `${tr('location_header', lang)}${loc}${tr('want_to_book', lang)}`, nextState: 'after_location' }
  }
  return { text: tr('no_location', lang) }
}

function showWebsite(bizName, biz, lang = 'en') {
  const url = biz?.website
  if (url) {
    return { text: tr('website_msg', lang, bizName, url) }
  }
  return { text: tr('no_website', lang) }
}

module.exports = { handleIncomingMessage }
