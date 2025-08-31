import TelegramBot from 'node-telegram-bot-api';

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
const bot = new TelegramBot(token);

const messages = {
  morning: [
    "🌅 Goedemorgen! Een nieuwe dag vol mogelijkheden. Wat ga je vandaag geweldig maken?",
    "☀️ Goedemorgen! Vandaag wordt een goede dag. Waar kijk je het meest naar uit?",
    "🌻 Hoi! De dag begint. Wat is je belangrijkste doel voor vandaag?",
  ],
  work: [
    "💼 Tijd om te beginnen! Wat is je #1 prioriteit voor vandaag?",
    "🚀 Werkdag start! Welke belangrijke taak ga je als eerst aanpakken?",
    "⚡ Focus time! Wat moet vandaag echt af zijn?",
  ],
  lunch: [
    "🍽️ Lunch tijd! Tijd voor een pauze. Wat ga je lekkers eten?",
    "🥗 Pauze moment! Hoe gaat je dag tot nu toe? En wat eet je?",
    "☕ Lunch break! Neem even rust. Wat heb je al bereikt vandaag?",
  ],
  afternoon: [
    "☕ Middag check! Hoe gaat het? Nog energie voor de laatste uren?",
    "⚡ Afternoon boost! Wat heb je al gedaan? Wat staat er nog op de lijst?",
    "🔋 Hoe is je energie? Tijd voor een korte pauze of doorgaan?",
  ],
  evening: [
    "🌙 Dag bijna voorbij! Waar ben je het meest trots op vandaag?",
    "✨ Avond reflectie: wat was je hoogtepunt van vandaag?",
    "🙏 Einde van de dag! Waar ben je dankbaar voor?",
  ]
};

function getRandomMessage(category) {
  const categoryMessages = messages[category];
  return categoryMessages[Math.floor(Math.random() * categoryMessages.length)];
}

function shouldSendMessage(hour, minute, day) {
  // 07:55 - Morning (daily)
  if (hour === 7 && minute >= 55) return { type: 'morning', send: true };
  
  // 08:30 - Work start (weekdays only)
  if (hour === 8 && minute >= 30 && day >= 1 && day <= 5) return { type: 'work', send: true };
  
  // 12:45 - Lunch (daily)
  if (hour === 12 && minute >= 45) return { type: 'lunch', send: true };
  
  // 15:00 - Afternoon check (daily)
  if (hour === 15 && minute >= 0) return { type: 'afternoon', send: true };
  
  // 22:00 - Evening (daily)
  if (hour === 22 && minute >= 0) return { type: 'evening', send: true };
  
  return { send: false };
}

export default async function handler(req, res) {
  try {
    const now = new Date();
    // Adjust for Amsterdam timezone (UTC+1/+2)
    const amsterdamTime = new Date(now.getTime() + (1 * 60 * 60 * 1000));
    const hour = amsterdamTime.getHours();
    const minute = amsterdamTime.getMinutes();
    const day = amsterdamTime.getDay(); // 0=Sunday, 1=Monday, etc.
    
    const check = shouldSendMessage(hour, minute, day);
    
    if (check.send) {
      const message = getRandomMessage(check.type);
      await bot.sendMessage(chatId, message);
      
      console.log(`Sent ${check.type} message at ${hour}:${minute}`);
      res.status(200).json({ 
        status: 'Message sent', 
        type: check.type,
        time: `${hour}:${minute}` 
      });
    } else {
      res.status(200).json({ 
        status: 'No message needed', 
        time: `${hour}:${minute}` 
      });
    }
    
  } catch (error) {
    console.error('Scheduler error:', error);
    res.status(500).json({ error: error.message });
  }
}
