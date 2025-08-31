import TelegramBot from 'node-telegram-bot-api';

const token = process.env.TELEGRAM_BOT_TOKEN;
const notionToken = process.env.NOTION_TOKEN;
const databaseId = process.env.NOTION_DATABASE_ID;
const chatId = process.env.TELEGRAM_CHAT_ID;

// Belangrijk: geen polling op serverless
const bot = new TelegramBot(token || '', { polling: false });

async function saveToNotion(message, reply, moment = 'chat') {
  if (!notionToken || !databaseId) {
    console.log('[Notion] Not configured -> skip', { hasToken: !!notionToken, hasDb: !!databaseId });
    return;
  }
  
  try {
    const body = {
      parent: { database_id: databaseId },
      properties: {
        DateTime: { date: { start: new Date().toISOString() } },
        Moment: { select: { name: moment } },
        Message: { rich_text: [{ text: { content: message.substring(0, 2000) } }] },
        Reply: { rich_text: [{ text: { content: reply.substring(0, 2000) } }] },
        Energy: parseEnergyFromText(reply),
        SleepHours: parseSleepHoursFromText(reply),
        SleepStart: parseSleepStartFromText(reply)
      }
    };

    console.log('[Notion] POST /v1/pages start');
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
      console.log('[Notion] Saved OK', { id: json?.id });
    }
  } catch (e) {
    console.error('[Notion] Save crash', e);
  }
}

function parseEnergyFromText(text) {
  const m = text.match(/(?:energy|energie)[:\s]*(\d+)(?:\/10)?|(\d+)\/10/i);
  if (!m) return null;
  const n = parseInt(m[1] || m[2], 10);
  return n >= 1 && n <= 10 ? { number: n } : null;
}

function parseSleepHoursFromText(text) {
  const m = text.match(/(?:slept|geslapen|slaap)[:\s]*(\d+(?:\.\d+)?)\s*(?:hours?|uur|u)/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return n >= 0 && n <= 15 ? { number: n } : null;
}

function parseSleepStartFromText(text) {
  const m = text.match(/(?:bed|slapen)\s*(?:at|om|around)[:\s]*(\d{1,2}[:.]?\d{0,2})/i);
  return m ? { rich_text: [{ text: { content: m[1] } }] } : null;
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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('[Webhook] Received POST request');
  
  try {
    const update = req.body;
    console.log('[Webhook] Update received:', JSON.stringify(update, null, 2));

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

📅 07:55 - Ochtend motivatie
💼 08:30 - Werkdag start (ma-vr)  
🍽️ 12:45 - Lunch reminder
☕ 15:00 - Middag check-in
🌙 22:00 - Avond reflectie

Je kunt altijd gewoon met me chatten!`;
    } else {
      replyMessage = `Bedankt voor je bericht: "${text}". Ik heb het genoteerd! 📝`;
    }

    console.log('[Webhook] Sending reply:', replyMessage.substring(0, 100) + '...');

    // Send Telegram reply
    try {
      const resp = await bot.sendMessage(receivedChatId, replyMessage);
      console.log('[Telegram] Reply sent successfully:', { message_id: resp?.message_id });
    } catch (telegramError) {
      console.error('[Telegram] Failed to send reply:', telegramError);
      // Don't return error here - still save to Notion
    }

    // Save to Notion
    const moment = determineMoment();
    console.log('[Webhook] Saving to Notion with moment:', moment);
    await saveToNotion(text, replyMessage, moment);

    return res.status(200).json({ 
      status: 'ok',
      processed: {
        chatId: receivedChatId,
        messageLength: text.length,
        moment: moment
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
