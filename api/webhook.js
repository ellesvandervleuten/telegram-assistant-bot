import TelegramBot from 'node-telegram-bot-api';

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const update = req.body;
    
    if (update.message) {
      const chatId = update.message.chat.id;
      const text = update.message.text;
      
      console.log(`Ontvangen bericht van ${chatId}: ${text}`);
      
      // Simpele responses
      if (text?.toLowerCase().includes('hoi') || text?.toLowerCase().includes('hallo')) {
        await bot.sendMessage(chatId, 'Hoi Elles! 👋 Ik ben je persoonlijke assistant. Ik ga je helpen met dagelijkse check-ins!');
      }
      else if (text?.toLowerCase().includes('help')) {
        await bot.sendMessage(chatId, `🤖 Ik stuur je automatisch berichten op deze tijden:
        
📅 07:55 - Ochtend motivatie
💼 08:30 - Werkdag start (ma-vr)  
🍽️ 12:45 - Lunch reminder
☕ 15:00 - Middag check-in
🌙 22:00 - Avond reflectie

Je kunt altijd gewoon met me chatten!`);
      }
      else {
        await bot.sendMessage(chatId, `Bedankt voor je bericht: "${text}". Ik heb het genoteerd! 📝`);
      }
    }
    
    res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
