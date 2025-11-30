import twilio from "twilio";

const FROM_PHONE = process.env.TWILIO_FROM_PHONE;
const TO_PHONE = process.env.TWILIO_TO_PHONE;
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

function getClient() {
  if (!accountSid || !authToken) {
    console.log("[Notification] Twilio credentials not configured - skipping SMS");
    return null;
  }
  return twilio(accountSid, authToken);
}

export async function sendWifeAlert(percent: number, movesCount: number) {
  console.log(`[Notification] Checking alert for ${percent}%...`);

  if (!FROM_PHONE || !TO_PHONE) {
    console.log("[Notification] Phone numbers not configured - skipping SMS");
    return;
  }

  const client = getClient();
  if (!client) return;

  const messages: Record<number, string> = {
    25: `Jeremy just hit 25% of his daily goal! (${movesCount} moves down)`,
    50: `Halfway there! Jeremy is at 50% for the day. Send coffee`,
    75: `Crushing it. 75% done. Almost time for dinner.`,
    100: `BOOM. Jeremy finished 100% of his work day. High five him!`
  };

  const body = messages[percent];
  if (!body) return;

  try {
    await client.messages.create({
      body,
      from: FROM_PHONE,
      to: TO_PHONE,
    });
    console.log(`[Notification] SMS sent to wife: ${percent}% milestone`);
  } catch (error) {
    console.error("[Notification] Failed to send SMS:", error);
  }
}
