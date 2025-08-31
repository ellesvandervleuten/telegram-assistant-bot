import TelegramBot from 'node-telegram-bot-api';

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID; // Je chat ID
const bot = new TelegramBot(token);

const morningMessages = [
  "🌅 Goedemorgen Elles! Een nieuwe dag vol mogelijkheden. Wat ga je vandaag geweldig maken?",
  "☀️ Goedemorgen! Vandaag wordt een goede dag. Waar kijk je het meest naar uit?",
  "🌻 Hoi Elles! De dag begint. Wat is je belangrijkste doel voor vandaag?",
  "💪 Goedemorgen warrior! Klaar om de dag te veroveren? Wat staat er op de planning?",
  "✨ Nieuwe dag, nieuwe kansen! Hoe voel je je en wat wil je bereiken?"
];

export default async function handler(req, res) {
  try {
    const randomMessage = morningMessages[Math.floor(Math.random() * morningMessages.length)];
    
    await bot.sendMessage(chatId, randomMessage);
    
    console.log('Morning nudge sent successfully');
    res.status(200).json({ status: 'Morning nudge sent' });
  } catch (error) {
    console.error('Error sending morning nudge:', error);
    res.status(500).json({ error: error.message });
  }
}
