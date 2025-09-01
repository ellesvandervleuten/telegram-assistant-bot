import TelegramBot from 'node-telegram-bot-api';

const token = process.env.TELEGRAM_BOT_TOKEN;
const notionToken = process.env.NOTION_TOKEN;
const databaseId = process.env.NOTION_DATABASE_ID;
const chatId = process.env.TELEGRAM_CHAT_ID;

// Belangrijk: geen polling op serverless
const bot = new TelegramBot(token || '', { polling: false });

// Variatie berichten voor verschillende momenten
const MORNING_MESSAGES = [
  '🌅 Goedemorgen! Een nieuwe dag vol mogelijkheden.',
  '☀️ Goedemorgen! Vandaag wordt een goede dag.',
  '🌻 Hoi! De dag begint.',
  '🌞 Vandaag begint fris — voeten op de grond, lamp aan, glas water.',
  '🚀 Kleine actie = momentum.',
  '🌟 Klaar voor een versie van jou die 1% beter is dan gisteren?'
];

const WORKDAY_START_MESSAGES = [
  '💼 Tijd om te beginnen! Wat is je #1 prioriteit voor vandaag?',
  '🚀 Werkdag start! Welke belangrijke taak ga je als eerst aanpakken?',
  '⚡ Focus time! Wat moet vandaag echt af zijn?',
  '✨ Dagstart! Energie nu (1–10)? Waar ben je mee bezig?',
  '📌 Kies je 3 belangrijkste prioriteiten voor vandaag.'
];

const LUNCH_MESSAGES = [
  '🍽️ Lunchtijd! Energie nu (1–10)?',
  '🥗 Pauze moment! Hoe gaat je dag tot nu toe? En wat eet je?',
  '☕ Lunch break! Neem even rust. Wat heb je al bereikt vandaag?',
  '✨ Herstel, dan weer knallen. Waar denk je aan?',
  '📌 Eén ding dat je straks wél wil afronden?'
];

const EVENING_MESSAGES = [
  '🌙 Nog een halfuurtje, Elles. Dim lichten, rond rustig af.',
  '🛏️ Klaar om langzaam af te bouwen? Hoeveel rust gun je jezelf vandaag?',
  '🌌 Eind van de dag → adem diep.',
  '✨ Hoeveel zachtheid geef je jezelf vanavond (1–10)?',
  '📖 Bedroutine starten = cadeau voor morgen.',
  '🌙 Sluit je schermen af, open de rust.'
];

function getRandomMessage(messages) {
  return messages[Math.floor(Math.random() * messages.length)];
}

function parseEnergyFromText(text) {
  // Zoek naar patronen zoals: "energie is 8", "mijn energie 7", "8/10", etc.
  const patterns = [
    /(?:mijn\s+)?(?:energy|energie)(?:\s+is|\s*[:=]\s*|\s+)(\d+)(?:\/10)?/i,
    /(\d+)\/10/,
    /energie\s*(\d+)/i,
    /energy\s*(\d+)/i
  ];
  
  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n >= 1 && n <= 10) return n;
    }
  }
  return null;
}

function parseSleepHoursFromText(text) {
  // Zoek naar patronen zoals: "8u 4min", "7.5 uur", "8 hours", etc.
  const patterns = [
    /(\d+)u\s*(\d+)?min/i,  // "8u 4min" format
    /(\d+(?:\.\d+)?)\s*(?:hours?|uur|u)(?!\s*\d+min)/i, // "8.5 uur" maar niet "8u 4min"
    /(?:slept|geslapen|geslaap)\s*(?:\w+\s+)*?(\d+)u\s*(\d+)?min/i, // "geslapen 8u 4min"
    /(?:slept|geslapen|geslaap)\s*(?:\w+\s+)*?(\d+(?:\.\d+)?)\s*(?:hours?|uur|u)/i
  ];
  
  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (m) {
      if (m[2] !== undefined) {
        // Format zoals "8u 4min"
        const hours = parseInt(m[1], 10);
        const minutes = parseInt(m[2], 10);
        const total = hours + (minutes / 60);
        if (total >= 0 && total <= 15) return Math.round(total * 100) / 100; // Afgerond op 2 decimalen
      } else {
        // Format zoals "8.5 uur"
        const n = parseFloat(m[1]);
        if (n >= 0 && n <= 15) return n;
      }
    }
  }
  return null;
}

function parseSleepStartFromText(text) {
  // Zoek naar patronen zoals: "om 00:31 in slaap gevallen", "bed om 23:30", etc.
  const patterns = [
    /om\s*(\d{1,2}[:.]?\d{2})\s*in\s*slaap/i, // "om 00:31 in slaap gevallen"
    /(\d{1,2}[:.]?\d{2})\s*in\s*slaap/i, // "00:31 in slaap gevallen"
    /(?:bed|slapen)(?:\s*(?:at|om|around)\s*)(\d{1,2}[:.]?\d{2})/i,
    /(?:at|om|around)\s*(\d{1,2}[:.]?\d{2})\s*(?:bed|slapen)/i
  ];
  
  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (m) return m[1];
  }
  return null;
}

function parseSleepScoreFromText(text) {
  // Zoek naar patronen zoals: "slaapscore 89", "sleep score: 85", etc.
  const patterns = [
    /(?:sleep\s*score|slaap\s*score|slaapscore)(?:\s*[:=]\s*|\s+)(\d+)/i,
    /slaapscore\s*(\d+)/i
  ];
  
  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (m) {
      const n = parseInt(m[1], 10);
      // Slaapscores kunnen hoger zijn dan 10 (zoals 89), dus geen maximum
      if (n >= 0 && n <= 100) return n;
    }
  }
  return null;
}

function determineMoment() {
  const h = new Date().getHours();
  if (h >= 6 && h < 9) return 'morning';
  if (h >= 9 && h < 12) return 'work';
  if (h >= 12 && h < 15) return 'lunch';
  if (h >= 15 && h < 18) return 'afternoon';
  if (h >= 18 && h < 23) return 'evening';
  return 'night';
}

async function saveToNotion(message, reply, moment = 'chat') {
  if (!notionToken || !databaseId) {
    console.log('[Notion] Not configured -> skip', { hasToken: !!notionToken, hasDb: !!databaseId });
    return;
  }
  
  try {
    // Parse specifieke waarden uit het bericht
    const energyValue = parseEnergyFromText(message);
    const sleepHours = parseSleepHoursFromText(message);
    const sleepStart = parseSleepStartFromText(message);
    const sleepScore = parseSleepScoreFromText(message);
    
    console.log('[Notion] Parsed values:', { 
      energy: energyValue, 
      sleepHours: sleepHours, 
      sleepStart: sleepStart,
      sleepScore: sleepScore 
    });

    // Basis properties die altijd worden toegevoegd
    const properties = {
      "DateTime": { 
        date: { 
          start: new Date().toISOString() 
        } 
      },
      "Moment": { 
        select: { name: moment } 
      },
      "Message": { 
        rich_text: [{ 
          text: { 
            content: message.substring(0, 2000) 
          } 
        }] 
      },
      "Reply": { 
        rich_text: [{ 
          text: { 
            content: reply.substring(0, 2000) 
          } 
        }] 
      }
    };

    // Voeg specifieke waarden toe als ze gevonden zijn
    if (energyValue !== null) {
      properties["Energy"] = { number: energyValue };
      console.log('[Notion] Adding Energy:', energyValue);
    }
    
    if (sleepHours !== null) {
      properties["SleepHours"] = { number: sleepHours };
      console.log('[Notion] Adding Sleep Hours:', sleepHours);
    }
    
    if (sleepStart) {
      properties["SleepStart"] = { 
        rich_text: [{ 
          text: { 
            content: sleepStart 
          } 
        }] 
      };
      console.log('[Notion] Adding Sleep Start:', sleepStart);
    }

    if (sleepScore !== null) {
      properties["SleepScore"] = { number: sleepScore };
      console.log('[Notion] Adding Sleep Score:', sleepScore);
    }

    const body = {
      parent: { database_id: databaseId },
      properties: properties
    };

    console.log('[Notion] POST /v1/pages with properties:', JSON.stringify(properties, null, 2));
    const r = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${notionToken}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify(body)
    });

    if (!r.ok) {
      const txt = await r.text();
      console.error('[Notion] API error', r.status, txt);
    } else {
      const json = await r.json();
      console.log('[Notion] Saved OK', { 
        id: json?.id, 
        parsedEnergy: energyValue,
        parsedSleepHours: sleepHours,
        parsedSleepScore: sleepScore 
      });
    }
  } catch (e) {
    console.error('[Notion] Save crash', e);
  }
}

async function sendScheduledMessage() {
  if (!chatId) {
    console.log('[Scheduled] No chat ID configured');
    return;
  }

  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const day = now.getDay(); // 0=zondag, 1=maandag, etc.
  
  let scheduledMessage = '';
  let scheduleMoment = '';

  // 🌅 07:55 - Ochtend
  if (hour === 7 && minute === 55) {
    const randomOpener = getRandomMessage(MORNING_MESSAGES);
    scheduledMessage = `${randomOpener}
Hoe voel je je wakker worden (1–10)?
⏱️ Hoe laat viel je volgens Fitbit in slaap?
🛏️ Hoeveel uur heb je geslapen?`;
    scheduleMoment = 'morning';
  }
  // 💼 08:30 - Werkdag start (ma-vr)
  else if (hour === 8 && minute === 30 && day >= 1 && day <= 5) {
    scheduledMessage = getRandomMessage(WORKDAY_START_MESSAGES);
    scheduleMoment = 'work';
  }
  // 🍽️ 12:45 - Lunch
  else if (hour === 12 && minute === 45) {
    scheduledMessage = getRandomMessage(LUNCH_MESSAGES);
    scheduleMoment = 'lunch';
  }
  // ⏰ Hourly check-ins
  else if ([9, 10, 11, 13, 14, 16, 18, 20, 21].includes(hour) && minute === 30) {
    scheduledMessage = '⏰ Check-in: Energie nu (1–10)? Waar ben je mee bezig?';
    scheduleMoment = 'hourly';
  }
  // ✅ 15:30 - Workday afsluiter
  else if (hour === 15 && minute === 30) {
    scheduledMessage = `✅ Workday afsluiter!
⏰ Energie nu (1–10)?
✨ Wat zijn 3 dingen die vandaag gelukt zijn?
📌 Welke taak neem je mee naar morgen?`;
    scheduleMoment = 'afternoon';
  }
  // 🌙 22:00 - Avond wind-down
  else if (hour === 22 && minute === 0) {
    const randomOpener = getRandomMessage(EVENING_MESSAGES);
    scheduledMessage = `${randomOpener}
Hoeveel rust geef je jezelf vandaag (1–10)?`;
    scheduleMoment = 'evening';
  }

  if (scheduledMessage) {
    try {
      console.log('[Scheduled] Sending message for moment:', scheduleMoment);
      await bot.sendMessage(chatId, scheduledMessage);
      await saveToNotion('SCHEDULED_MESSAGE', scheduledMessage, scheduleMoment);
      console.log('[Scheduled] Message sent successfully');
    } catch (error) {
      console.error('[Scheduled] Failed to send message:', error);
    }
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('[Webhook] Received POST request');
  
  try {
    const update = req.body;

    // Check if this is a scheduled message trigger
    if (update?.source === 'github-actions') {
      console.log('[Webhook] Scheduled message trigger');
      await sendScheduledMessage();
      return res.status(200).json({ status: 'Scheduled check completed' });
    }

    console.log('[Webhook] Regular update received:', JSON.stringify(update, null, 2));

    if (!token) {
      console.error('[Telegram] TELEGRAM_BOT_TOKEN missing');
      return res.status(500).json({ error: 'Bot token missing' });
    }

    if (!update?.message) {
      console.log('[Webhook] No message in update, skipping');
      return res.status(200).json({ status: 'No message to process' });
    }

    const message = update.message;
    const receivedChatId = message.chat.id;
    const text = message.text || '';
    
    console.log('[Webhook] Processing message:', { 
      chatId: receivedChatId, 
      text: text,
      messageId: message.message_id 
    });

    // Check if this is from the expected chat
    if (chatId && receivedChatId.toString() !== chatId.toString()) {
      console.log('[Webhook] Message from unexpected chat ID:', receivedChatId);
      return res.status(200).json({ status: 'Message from unexpected chat' });
    }

    let replyMessage = '';
    const lc = text.toLowerCase();

    if (lc.includes('hoi') || lc.includes('hallo')) {
      replyMessage = 'Hoi Elles! 👋 Ik ben je persoonlijke assistant. Ik ga je helpen met dagelijkse check-ins!';
    } else if (lc.includes('help')) {
      replyMessage = `🤖 Ik stuur je automatisch berichten op deze tijden:

🌅 07:55 - Ochtend motivatie  
💼 08:30 - Werkdag start (ma-vr)
⏰ 09:30-21:00 - Uurlijkse check-ins
🍽️ 12:45 - Lunch reminder
✅ 15:30 - Workday afsluiter
🌙 22:00 - Avond reflectie

Je kunt altijd gewoon met me chatten!`;
    } else {
      // Parse alle waarden uit het bericht voor de reply
      const energy = parseEnergyFromText(text);
      const sleepHours = parseSleepHoursFromText(text);
      const sleepScore = parseSleepScoreFromText(text);
      const sleepStart = parseSleepStartFromText(text);
      
      let replyParts = [];
      
      if (energy !== null) {
        replyParts.push(`📝 Energie ${energy}/10 genoteerd!`);
      }
      if (sleepHours !== null) {
        replyParts.push(`💤 ${sleepHours} uur slaap gelogd!`);
      }
      if (sleepScore !== null) {
        replyParts.push(`😴 Slaapscore ${sleepScore} opgeslagen!`);
      }
      if (sleepStart) {
        replyParts.push(`🛏️ Bedtijd ${sleepStart} genoteerd!`);
      }
      
      if (replyParts.length > 0) {
        replyMessage = replyParts.join(' ') + `\n\nVolledige bericht: "${text}"`;
      } else {
        replyMessage = `Bedankt voor je bericht: "${text}". Ik heb het genoteerd! 📝`;
      }
    }

    console.log('[Webhook] Sending reply:', replyMessage.substring(0, 100) + '...');

    // Send Telegram reply
    try {
      const resp = await bot.sendMessage(receivedChatId, replyMessage);
      console.log('[Telegram] Reply sent successfully:', { message_id: resp?.message_id });
    } catch (telegramError) {
      console.error('[Telegram] Failed to send reply:', telegramError);
    }

    // Save to Notion with parsing
    const moment = determineMoment();
    console.log('[Webhook] Saving to Notion with moment:', moment);
    await saveToNotion(text, replyMessage, moment);

    return res.status(200).json({ 
      status: 'ok',
      processed: {
        chatId: receivedChatId,
        messageLength: text.length,
        moment: moment,
        parsedEnergy: parseEnergyFromText(text),
        parsedSleepHours: parseSleepHoursFromText(text),
        parsedSleepScore: parseSleepScoreFromText(text)
      }
    });

  } catch (error) {
    console.error('[Webhook] Handler crashed:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}
