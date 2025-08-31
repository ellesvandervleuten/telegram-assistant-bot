import TelegramBot from 'node-telegram-bot-api';

const token = process.env.TELEGRAM_BOT_TOKEN;
const notionToken = process.env.NOTION_TOKEN;
const databaseId = process.env.NOTION_DATABASE_ID;
const bot = new TelegramBot(token);

async function saveToNotion(message, reply, moment = 'chat') {
  // Skip saving if Notion not configured
  if (!notionToken || !databaseId) {
    console.log('Notion not configured, skipping save');
    return;
  }

  try {
    const response = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${notionToken}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify({
        parent: { database_id: databaseId },
        properties: {
          DateTime: { 
            date: { 
              start: new Date().toISOString() 
            } 
          },
          Moment: { 
            select: { 
              name: moment 
            } 
          },
          Message: { 
            rich_text: [{ 
              text: { 
                content: message.substring(0, 2000) // Notion has character limits
              } 
            }] 
          },
          Reply: { 
            rich_text: [{ 
              text: { 
                content: reply.substring(0, 2000) 
              } 
            }] 
          },
          Energy: parseEnergyFromText(reply),
          SleepHours: parseSleepHoursFromText(reply),
          SleepStart: parseSleepStartFromText(reply)
        }
      })
    });

    if (!response.ok) {
      console.error('Notion API error:', response.status, await response.text());
    } else {
      console.log('Successfully saved to Notion');
    }
  } catch (error) {
    console.error('Notion save error:', error);
  }
}

function parseEnergyFromText(text) {
  // Look for patterns like "energy: 7", "7/10", "energie 8", etc.
  const energyPattern = /(?:energy|energie)[:\s]*(\d+)(?:\/10)?|(\d+)\/10/i;
  const match = text.match(energyPattern);
  if (match) {
    const number = parseInt(match[1] || match[2]);
    if (number >= 1 && number <= 10) {
      return { number: number };
    }
  }
  return null;
}

function parseSleepHoursFromText(text) {
  // Look for patterns like "slept 7 hours", "7u geslapen", etc.
  const sleepPattern = /(?:slept|geslapen|slaap)[:\s]*(\d+(?:\.\d+)?)\s*(?:hours?|uur|u)/i;
  const match = text.match(sleepPattern);
  if (match) {
    const hours = parseFloat(match[1]);
    if (hours >= 0 && hours <= 15) {
      return { number: hours };
    }
  }
  return null;
}

function parseSleepStartFromText(text) {
  // Look for patterns like "bed at 23:30", "naar bed om 22:00", etc.
  const bedtimePattern = /(?:bed|slapen)\s*(?:at|om|around)[:\s]*(\d{1,2}[:.]?\d{0,2})/i;
  const match = text.match(bedtimePattern);
  if (match) {
    return { 
      rich_text: [{ 
        text: { 
          content: match[1] 
        } 
      }] 
    };
  }
  return null;
}

function determineMoment() {
  const now = new Date();
  const hour = now.getHours();
  
  if (hour >= 6 && hour < 9) return 'morning';
  if (hour >= 9 && hour < 12) return 'work';
  if (hour >= 12 && hour < 15) return 'lunch';
  if (hour >= 15 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 23) return 'evening';
  return 'night';
}

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
      console.log('Debug - notionToken exists:', !!notionToken, 'databaseId exists:', !!databaseId);

      
      let replyMessage = '';
      
      // Simpele responses
      if (text?.toLowerCase().includes('hoi') || text?.toLowerCase().includes('hallo')) {
        replyMessage = 'Hoi Elles! 👋 Ik ben je persoonlijke assistant. Ik ga je helpen met dagelijkse check-ins!';
        await bot.sendMessage(chatId, replyMessage);
      }
      else if (text?.toLowerCase().includes('help')) {
        replyMessage = `🤖 Ik stuur je automatisch berichten op deze tijden:
        
📅 07:55 - Ochtend motivatie
💼 08:30 - Werkdag start (ma-vr)  
🍽️ 12:45 - Lunch reminder
☕ 15:00 - Middag check-in
🌙 22:00 - Avond reflectie

Je kunt altijd gewoon met me chatten!`;
        await bot.sendMessage(chatId, replyMessage);
      }
      else {
        replyMessage = `Bedankt voor je bericht: "${text}". Ik heb het genoteerd! 📝`;
        await bot.sendMessage(chatId, replyMessage);
      }
      
      // Save interaction to Notion
      const moment = determineMoment();
      await saveToNotion(text, replyMessage, moment);
    }
    
    res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
