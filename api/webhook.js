import TelegramBot from 'node-telegram-bot-api';

const token = process.env.TELEGRAM_BOT_TOKEN;
const notionToken = process.env.NOTION_TOKEN;
const databaseId = process.env.NOTION_DATABASE_ID;
const chatId = process.env.TELEGRAM_CHAT_ID;

// Belangrijk: geen polling op serverless
const bot = new TelegramBot(token || '', { polling: false });

// In-memory cache voor duplicaat preventie (reset bij elke cold start)
let lastSentMessages = new Map();

// Variatie berichten voor verschillende momenten
const MORNING_MESSAGES = [
  '🌅 Je bent wakker. Dat is al een overwinning. Vandaag ga je jezelf verrassen.',
  '☀️ Elke dag die je begint is bewijs van je kracht. Tijd om te laten zien wat je kunt.',
  '🌻 Je lichaam heeft gerust, je geest is wakker. Jij bepaalt hoe deze dag verloopt.',
  '🌞 Opstaan is moeilijk, maar jij doet moeilijke dingen. Voeten op de grond, jij regelt dit.',
  '🚀 Je hebt al zoveel bereikt door gewoon hier te zijn. Vandaag bouw je daarop voort.',
  '🌟 Niet iedereen durft hun dromen na te jagen. Jij wel. Vandaag weer een stap dichterbij.',
  '💪 Je hoofd zegt misschien "blijf liggen", maar jij beslist. Jij bent sterker dan je denkt.',
  '✨ Deze dag wacht op jou. Niemand anders kan doen wat jij vandaag gaat doen.',
  '🔥 Je bent hier niet toevallig. Je hebt een doel, een reden. Laat het vandaag zien.',
  '🌈 Elke dag dat je begint, maak je iemand trots. Vooral jezelf.'
];

const WORKDAY_START_MESSAGES = [
  '💼 Werkdag start! Wat is je belangrijkste prioriteit vandaag?\n\nProductiviteit, stemming, stress (1-10)? Bezig met: opdracht/marketing/sales/administratie/ontspanning/kennisvergaring?',
  '🚀 Focus time! Welke taak pak je als eerste aan?\n\nProductiviteit, stemming, stress (1-10)? Bezig met: opdracht/marketing/sales/administratie/ontspanning/kennisvergaring?',
  '⚡ Tijd om te beginnen! Wat moet vandaag echt af?\n\nProductiviteit, stemming, stress (1-10)? Bezig met: opdracht/marketing/sales/administratie/ontspanning/kennisvergaring?',
  '✨ Dagstart werkmode! Waar ga je je op focussen?\n\nProductiviteit, stemming, stress (1-10)? Bezig met: opdracht/marketing/sales/administratie/ontspanning/kennisvergaring?'
];

const LUNCH_MESSAGES = [
  '🍽️ Lunchtijd! Wat eet je?\n\nProductiviteit, stemming, stress (1-10)? Bezig met: opdracht/marketing/sales/administratie/ontspanning/kennisvergaring?',
  '🥗 Pauze moment! Hoe gaat je dag tot nu toe?\n\nProductiviteit, stemming, stress (1-10)? Bezig met: opdracht/marketing/sales/administratie/ontspanning/kennisvergaring?',
  '☕ Lunch break! Wat heb je al bereikt vandaag?\n\nProductiviteit, stemming, stress (1-10)? Bezig met: opdracht/marketing/sales/administratie/ontspanning/kennisvergaring?',
  '✨ Herstel, dan weer knallen!\n\nProductiviteit, stemming, stress (1-10)? Bezig met: opdracht/marketing/sales/administratie/ontspanning/kennisvergaring?'
];

const EVENING_MESSAGES = [
  '🌙 Nog een halfuurtje, Elles. Dim lichten, rond rustig af.',
  '🛏️ Klaar om langzaam af te bouwen? Hoeveel rust gun je jezelf vandaag?',
  '🌌 Eind van de dag → adem diep.',
  '✨ Hoeveel zachtheid geef je jezelf vanavond (1–10)?',
  '📖 Bedroutine starten = cadeau voor morgen.',
  '🌙 Sluit je schermen af, open de rust.'
];

const BEDTIME_MESSAGES = [
  '🌙 Het is 23:00. Schermen dicht, gedachten zacht. Morgen ben je jezelf dankbaar.',
  '🛏️ Tijd om af te ronden. Warmte, stilte, slapen. Je lichaam mag herstellen.',
  '🌌 Je hoeft nu niets meer. Laat de dag los, adem uit, slaap in.',
  '💤 Rust is productief: elke minuut slaap betaalt morgen uit.',
  '📖 Kies voor je avondritueel: licht dimmen, korte notitie, dankbaar, slapen.',
  '🌟 Vandaag heb je genoeg gedaan. Je bed wacht, je dromen roepen.',
  '✨ Morgen is een nieuw canvas. Vannacht schildert slaap je kracht terug.',
  '🕯️ Licht uit, hart open. Elke nacht is een geschenk voor wie durft te rusten.',
  '🌸 Je gedachten mogen stoppen. Je lichaam neemt het over. Vertrouw de nacht.',
  '🌙 Slapen is geen luxe, het is liefde voor jezelf. Gun jezelf deze zachtheid.',
  '💫 De wereld draait door zonder jou. Jij mag nu volledig loslaten.',
  '🛌 Tussen deze lakens ligt je toekomst: uitgerust, helder, sterk.',
  '🌊 Laat je dag wegvloeien als water. Morgen vult zich vanzelf met mogelijkheden.',
  '🎭 Het toneelstuk van vandaag is klaar. Het doek valt, jij mag applaudisseren voor jezelf.'
];

function getRandomMessage(messages) {
  return messages[Math.floor(Math.random() * messages.length)];
}

function parseProductivityFromText(text) {
  // Zoek naar patronen zoals: "productiviteit is 8", "productief 7", etc.
  const patterns = [
    /(?:mijn\s+)?(?:productivity|productiviteit)(?:\s+is|\s*[:=]\s*|\s+)(\d+)(?:\/10)?/i,
    /productiviteit\s*(\d+)/i,
    /productivity\s*(\d+)/i,
    /(?:productief|productive)(?:\s+is|\s*[:=]\s*|\s+)(\d+)(?:\/10)?/i
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

function parseMoodFromText(text) {
  const patterns = [
    /(?:mood|stemming)(?:\s+is|\s*[:=]\s*|\s+)(\d+)(?:\/10)?/i,
    /stemming\s*(\d+)/i,
    /mood\s*(\d+)/i
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

function parseStressFromText(text) {
  console.log('[Parse] Parsing stress from:', text);
  
  const patterns = [
    /(?:stress|spanning)(?:\s+is|\s*[:=]\s*|\s+)(\d+)(?:\/10)?/i,
    /stress\s*(\d+)/i,
    /spanning\s*(\d+)/i
  ];
  
  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i];
    const m = text.match(pattern);
    console.log(`[Parse] Stress pattern ${i + 1}:`, pattern, '-> Match:', m);
    
    if (m) {
      const n = parseInt(m[1], 10);
      console.log(`[Parse] Found stress: ${n}`);
      if (n >= 1 && n <= 10) return n;
    }
  }
  console.log('[Parse] No stress found');
  return null;
}

function parseWorkTypeFromText(text) {
  const patterns = [
    /(?:bezig\s+met|werk|werkend\s+aan|focus\s+op)(?:\s*[:=]\s*|\s+)(opdracht|marketing|sales|administratie|admin|ontspanning|kennisvergaring|kennis)/i,
    /(opdracht|marketing|sales|administratie|admin|ontspanning|kennisvergaring|kennis)/i
  ];
  
  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (m) {
      let workType = m[1].toLowerCase();
      // Normaliseer variaties
      if (workType === 'admin') workType = 'administratie';
      if (workType === 'kennis') workType = 'kennisvergaring';
      return workType;
    }
  }
  return null;
}

function parseSleepHoursFromText(text) {
  console.log('[Parse] Parsing sleep hours from:', text);
  
  // Zoek naar patronen zoals: "8 u 4 min", "8u 4min", "7.5 uur", etc.
  const patterns = [
    /(\d+)\s*u\s*(\d+)\s*min(?:\s+geslapen)?/i,  // "8 u 4 min geslapen"
    /(\d+)u\s*(\d+)min/i,  // "8u 4min" format
    /(?:geslapen|geslaap|geslapn)\s*[,\s]*(\d+)\s*u\s*(\d+)\s*min/i, // "geslapen, 8 u 4 min"
    // Zorg dat dit patroon NIET matcht met tijd formaten (00:31)
    /(?:geslapen|geslaap|geslapn)\s*[,\s]*(\d+(?:\.\d+)?)\s*(?:hours?|uur)(?!\s*in\s*slaap)/i, // "geslapen 8.5 uur"
    /(\d+(?:\.\d+)?)\s*(?:hours?|uur)(?:\s+geslapen)?(?!\s*in\s*slaap)(?!.*00:)/i // "8.5 uur geslapen" maar niet bij tijden
  ];
  
  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i];
    const m = text.match(pattern);
    console.log(`[Parse] Pattern ${i + 1}:`, pattern, '-> Match:', m);
    
    if (m) {
      if (m[2] !== undefined && m[2] !== '') {
        // Format zoals "8 u 4 min"
        const hours = parseInt(m[1], 10);
        const minutes = parseInt(m[2], 10);
        const total = hours + (minutes / 60);
        const rounded = Math.round(total * 100) / 100; // Afgerond op 2 decimalen
        console.log(`[Parse] Found hours+minutes: ${hours}h ${minutes}m = ${rounded}`);
        if (total >= 0 && total <= 15) return rounded;
      } else {
        // Format zoals "8.5 uur"
        const n = parseFloat(m[1]);
        console.log(`[Parse] Found decimal hours: ${n}`);
        if (n >= 0 && n <= 15) return n;
      }
    }
  }
  console.log('[Parse] No sleep hours found');
  return null;
}

function parseSleepStartFromText(text) {
  console.log('[Parse] Parsing sleep start from:', text);
  
  // Zoek naar patronen zoals: "Om 00:31 uur in slaap gevallen", etc.
  const patterns = [
    /om\s*(\d{1,2}[:.]?\d{2})\s*uur\s*in\s*slaap/i, // "Om 00:31 uur in slaap gevallen"
    /om\s*(\d{1,2}[:.]?\d{2})\s*in\s*slaap/i, // "om 00:31 in slaap gevallen"
    /(\d{1,2}[:.]?\d{2})\s*uur\s*in\s*slaap/i, // "00:31 uur in slaap gevallen"
    /(\d{1,2}[:.]?\d{2})\s*in\s*slaap/i, // "00:31 in slaap gevallen"
    /(?:bed|slapen)(?:\s*(?:at|om|around)\s*)(\d{1,2}[:.]?\d{2})/i,
    /(?:at|om|around)\s*(\d{1,2}[:.]?\d{2})\s*(?:bed|slapen)/i
  ];
  
  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i];
    const m = text.match(pattern);
    console.log(`[Parse] Pattern ${i + 1}:`, pattern, '-> Match:', m);
    
    if (m) {
      console.log(`[Parse] Found sleep start: ${m[1]}`);
      return m[1];
    }
  }
  console.log('[Parse] No sleep start found');
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

function shouldSendScheduledMessage(hour, minute, day) {
  const today = new Date().toISOString().split('T')[0]; // '2025-09-01'
  
  let messageType = null;
  
  // 🌅 07:55-07:59 - Morning (daily)
  if (hour === 7 && minute >= 55) {
    messageType = 'morning';
  }
  // 💼 08:30-08:59 - Work start (weekdays only)
  else if (hour === 8 && minute >= 30 && day >= 1 && day <= 5) {
    messageType = 'work';
  }
  // 🍽️ 12:45-12:59 - Lunch (daily)
  else if (hour === 12 && minute >= 45) {
    messageType = 'lunch';
  }
  // ✅ 15:30-15:59 - Afternoon check (daily)
  else if (hour === 15 && minute >= 30) {
    messageType = 'afternoon';
  }
  // 🌙 22:00-22:29 - Evening (daily)
  else if (hour === 22 && minute >= 0 && minute < 30) {
    messageType = 'evening';
  }
  // ⏰ Hourly check-ins op :30-:59 voor deze uren
  else if ([9, 10, 11, 13, 14, 16, 18, 20, 21].includes(hour) && minute >= 30) {
    messageType = `hourly-${hour}`;
  }
  
  if (!messageType) {
    console.log(`[Schedule] No message type for ${hour}:${minute.toString().padStart(2, '0')}`);
    return { send: false };
  }
  
  // Check voor duplicaten
  const key = `${messageType}-${today}`;
  const lastSent = lastSentMessages.get(key);
  
  // Als we dit type bericht vandaag al hebben gestuurd, skip
  if (lastSent) {
    console.log(`[Schedule] Skipping duplicate ${messageType} for ${today} (last sent: ${new Date(lastSent).toLocaleTimeString()})`);
    return { send: false };
  }
  
  // Markeer als verzonden
  lastSentMessages.set(key, Date.now());
  console.log(`[Schedule] Will send ${messageType} message`);
  
  return { 
    type: messageType.startsWith('hourly-') ? 'hourly' : messageType, 
    send: true,
    messageType: messageType
  };
}

async function saveToNotion(message, reply, moment = 'chat') {
  if (!notionToken || !databaseId) {
    console.log('[Notion] Not configured -> skip', { hasToken: !!notionToken, hasDb: !!databaseId });
    return;
  }
  
  try {
    // Parse specifieke waarden uit het bericht
    console.log('[Notion] Starting to parse message:', message);
    const productivityValue = parseProductivityFromText(message);
    const sleepHours = parseSleepHoursFromText(message);
    const sleepStart = parseSleepStartFromText(message);
    const sleepScore = parseSleepScoreFromText(message);
    const moodValue = parseMoodFromText(message);
    const stressValue = parseStressFromText(message);
    const workType = parseWorkTypeFromText(message);
    
    console.log('[Notion] Final parsed values:', { 
      productivity: productivityValue, 
      sleepHours: sleepHours, 
      sleepStart: sleepStart,
      sleepScore: sleepScore,
      mood: moodValue,
      stress: stressValue,
      workType: workType
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
    if (productivityValue !== null) {
      properties["Productivity"] = { number: productivityValue };
      console.log('[Notion] Adding Productivity:', productivityValue);
    }
    
    if (sleepHours !== null) {
      properties["SleepHours"] = { number: sleepHours };
      console.log('[Notion] Adding SleepHours:', sleepHours);
    }
    
    if (sleepStart) {
      properties["SleepStart"] = { 
        rich_text: [{ 
          text: { 
            content: sleepStart 
          } 
        }] 
      };
      console.log('[Notion] Adding SleepStart:', sleepStart);
    }

    if (sleepScore !== null) {
      properties["SleepScore"] = { number: sleepScore };
      console.log('[Notion] Adding SleepScore:', sleepScore);
    }

    if (moodValue !== null) {
      properties["Mood"] = { number: moodValue };
      console.log('[Notion] Adding Mood:', moodValue);
    }

    if (stressValue !== null) {
      properties["Stress"] = { number: stressValue };
      console.log('[Notion] Adding Stress:', stressValue);
    }

    if (workType) {
      properties["WorkType"] = { 
        select: { name: workType } 
      };
      console.log('[Notion] Adding WorkType:', workType);
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
        parsedProductivity: productivityValue,
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

  // Nederlandse tijd (UTC+1/+2)
  const now = new Date();
  const nlTime = new Date(now.toLocaleString("en-US", {timeZone: "Europe/Amsterdam"}));
  const hour = nlTime.getHours();
  const minute = nlTime.getMinutes();
  const day = nlTime.getDay(); // 0=zondag, 1=maandag, etc.
  
  console.log(`[Scheduled] Current NL time: ${hour}:${minute.toString().padStart(2, '0')}, day: ${day}`);
  
  const check = shouldSendScheduledMessage(hour, minute, day);
  
  if (!check.send) {
    console.log('[Scheduled] No message needed at this time');
    return;
  }

  let scheduledMessage = '';
  const messageType = check.type;

  // Kies bericht op basis van type
  if (messageType === 'morning') {
    const randomOpener = getRandomMessage(MORNING_MESSAGES);
    scheduledMessage = `${randomOpener}
Hoe voel je je wakker worden (1–10)?
⏱️ Hoe laat viel je volgens Fitbit in slaap?
🛏️ Hoeveel uur heb je geslapen?`;
  } else if (messageType === 'work') {
    scheduledMessage = getRandomMessage(WORKDAY_START_MESSAGES);
  } else if (messageType === 'lunch') {
    scheduledMessage = getRandomMessage(LUNCH_MESSAGES);
  } else if (messageType === 'afternoon') {
    scheduledMessage = `✅ Workday afsluiter! Wat zijn 3 dingen die vandaag gelukt zijn?

Productiviteit, stemming, stress (1–10)? Bezig met: opdracht/marketing/sales/administratie/ontspanning/kennisvergaring?`;
  } else if (messageType === 'evening') {
    const randomOpener = getRandomMessage(EVENING_MESSAGES);
    scheduledMessage = `${randomOpener}
Hoeveel rust geef je jezelf vandaag (1–10)?`;
  } else if (messageType === 'hourly') {
    scheduledMessage = '⏰ Check-in: Productiviteit, stemming, stress (1–10)? Bezig met: opdracht/marketing/sales/administratie/ontspanning/kennisvergaring?';
  }

  if (scheduledMessage) {
    try {
      console.log(`[Scheduled] Sending ${messageType} message:`, scheduledMessage.substring(0, 50) + '...');
      await bot.sendMessage(chatId, scheduledMessage);
      await saveToNotion('SCHEDULED_MESSAGE', scheduledMessage, messageType);
      console.log(`[Scheduled] ${messageType} message sent successfully`);
    } catch (error) {
      console.error(`[Scheduled] Failed to send ${messageType} message:`, error);
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
    const messageId = message.message_id;
    
    console.log('[Webhook] Processing message:', { 
      chatId: receivedChatId, 
      text: text,
      messageId: messageId 
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
⏰ 09:30-21:30 - Uurlijkse check-ins
🍽️ 12:45 - Lunch reminder
✅ 15:30 - Workday afsluiter
🌙 22:00 - Avond reflectie

Je kunt altijd gewoon met me chatten!`;
    } else {
      // Parse alle waarden uit het bericht voor de reply
      const productivity = parseProductivityFromText(text);
      const sleepHours = parseSleepHoursFromText(text);
      const sleepScore = parseSleepScoreFromText(text);
      const sleepStart = parseSleepStartFromText(text);
      const mood = parseMoodFromText(text);
      const stress = parseStressFromText(text);
      const workType = parseWorkTypeFromText(text);
      
      let replyParts = [];
      
      if (productivity !== null) {
        replyParts.push(`📈 Productiviteit ${productivity}/10 genoteerd!`);
      }
      if (mood !== null) {
        replyParts.push(`😊 Stemming ${mood}/10 opgeslagen!`);
      }
      if (stress !== null) {
        replyParts.push(`😰 Stress ${stress}/10 genoteerd!`);
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
      if (workType) {
        replyParts.push(`💼 Werktype: ${workType} gelogd!`);
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
        parsedProductivity: parseProductivityFromText(text),
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
