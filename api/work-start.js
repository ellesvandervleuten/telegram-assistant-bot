import TelegramBot from 'node-telegram-bot-api';

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
const bot = new TelegramBot(token);

const workMessages = [
  "💼 Tijd om te beginnen! Wat is je #1 prioriteit voor vandaag?",
  "🚀 Werkdag start! Welke belangrijke taak ga je als eerst aanpakken?",
  "⚡ Focus time! Wat moet vandaag echt af zijn?",
  "🎯 Goedemorgen! Welke 3 dingen maken vandaag succesvol?",
  "💡 Werkdag begint! Waar ga je je energie in stoppen?"
];

export default async function handler(req, res) {
  try {
    // Check if it's a weekday (Monday = 1, Friday = 5)
    const today = new Date();
    const day = today.getDay();
    
    if (day === 0 || day === 6) { // Sunday = 0, Saturday = 6
      console.log('Weekend - no work nudge sent');
      return res.status(200).json({ status: 'Weekend - no message sent' });
    }
    
    const randomMessage = workMessages[Math.floor(Math.random() * workMessages.length)];
    
    await bot.sendMessage(chatId, randomMessage);
    
    console.log('Work start nudge sent successfully');
    res.status(200).json({ status: 'Work start nudge sent' });
  } catch (error) {
    console.error('Error sending work start nudge:', error);
    res.status(500).json({ error: error.message });
  }
}
