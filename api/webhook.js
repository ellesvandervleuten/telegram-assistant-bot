import TelegramBot from 'node-telegram-bot-api';

const token = process.env.TELEGRAM_BOT_TOKEN;
const notionToken = process.env.NOTION_TOKEN;
const databaseId = process.env.NOTION_DATABASE_ID;

// Belangrijk: geen polling op serverless
const bot = new TelegramBot(token || '', { polling: false });

async function saveToNotion(message: string, reply: string, moment = 'chat') {
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
        Reply:   { rich_text: [{ text: { content: reply.substring(0, 2000) } }] },
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

function parseEnergyFromText(text: string) {
  const m = text.match(/(?:energy|energie)[:\s]*(\d+)(?:\/10)?|(\d+)\/10/i);
  if (!m) return null;
  const n = parseInt(m[1] || m[2]!, 10);
  return n >= 1 && n <= 10 ? { number: n } : null;
}
function parseSleepHoursFromText(text: string) {
  const m = text.match(/(?:slept|geslapen|slaap)[:\s]*(\d+(?:\.\d+)?)\s*(?:hours?|uur|u)/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return n >= 0 && n <= 15 ? { number: n } : null;
}
function parseSleepStartFromText(text: string) {
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

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  console.log('[Webhook] Received');
  try {
    const update = req.body;
    console.log('[Webhook] Raw body', JSON.stringify(update)?.slice(0, 500));

    if (!token) {
      console.error('[Telegram] TELEGRAM_BOT_TOKEN missing');
    }

    if (update?.message) {
      const chatId = update.message.chat.id;
      const text = update.message.text || '';
      console.log('[Webhook] Message', { chatId, text });

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

      // Telegram reply
      try {
        console.log('[Telegram] sendMessage ->', { chatId, preview: replyMessage.slice(0, 80) });
        const resp = await bot.sendMessage(chatId, replyMessage);
        console.log('[Telegram] sendMessage OK', { message_id: resp?.message_id });
      } catch (e) {
        console.error('[Telegram] sendMessage error', e);
      }

      // Notion save
      const moment = determineMoment();
      await saveToNotion(text, replyMessage, moment);
    } else {
      console.log('[Webhook] No message field, ignoring');
    }

    return res.status(200).json({ status: 'ok' });
  } catch (e) {
    console.error('[Webhook] Crash', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
