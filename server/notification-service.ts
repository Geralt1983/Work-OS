// server/notification-service.ts
// Using ntfy.sh for free, instant push notifications

const TOPIC = "Jeremys-Impressive-Work-Updates"; 

export async function sendWifeAlert(percent: number, movesCount: number) {
  console.log(`[Notification] Sending ${percent}% alert via ntfy.sh/${TOPIC}...`);

  const messages: Record<number, string> = {
    25: `🚀 25% Complete (${movesCount} moves)`,
    50: `🔥 50% Done. Halfway there!`,
    75: `😤 75% Done. Crushing it.`,
    100: `✅ 100% FINISHED. Day complete!`
  };

  const message = messages[percent];
  if (!message) return;

  try {
    // ntfy.sh is dead simple: just POST to the URL
    const response = await fetch(`https://ntfy.sh/${TOPIC}`, {
      method: 'POST',
      body: message,
      headers: {
        'Title': 'Work OS Update',
        'Tags': 'tada,chart_with_upwards_trend', // Adds emojis in the notification
        'Priority': percent === 100 ? 'high' : 'default'
      }
    });
    
    // Log the actual HTTP response
    console.log(`[Notification] HTTP Status: ${response.status} ${response.statusText}`);
    const responseText = await response.text();
    console.log(`[Notification] Response: ${responseText || '(empty)'}`);
    
    if (!response.ok) {
      console.error(`❌ Ntfy Error: HTTP ${response.status} - ${responseText}`);
      return;
    }
    
    console.log(`✅ Ntfy sent to topic: ${TOPIC}`);
  } catch (error) {
    console.error("❌ Ntfy Network Error:", error instanceof Error ? error.message : error);
  }
}
