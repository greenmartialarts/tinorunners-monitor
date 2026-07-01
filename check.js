const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const URL = 'https://tinorunners.org';
const NTFY_TOPIC = process.env.NTFY_TOPIC || 'tinorunners-updates-alert';

function hashContent(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

async function main() {
  console.log(`Fetching ${URL}...`);
  try {
    const response = await fetch(URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch website: ${response.status} ${response.statusText}`);
    }
    const html = await response.text();
    const currentHash = hashContent(html);
    console.log(`Computed website hash: ${currentHash}`);

    // Regex to match "Week of MM/DD/YY"
    const weekRegex = /Week of \d{1,2}\/\d{1,2}\/\d{2,4}/i;
    const match = html.match(weekRegex);

    if (!match) {
      console.log('Could not find week schedule pattern in HTML.');
      return;
    }

    const currentWeek = match[0].trim();
    console.log(`Found schedule week: "${currentWeek}"`);

    // Extract site last updated date if available
    const updatedRegex = /last updated:\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i;
    const updatedMatch = html.match(updatedRegex);
    const lastUpdated = updatedMatch ? updatedMatch[1] : 'unknown';
    console.log(`Site last updated: ${lastUpdated}`);

    // Load status
    const statusPath = path.join(__dirname, 'status.json');
    let status = { last_notified_week: '' };
    if (fs.existsSync(statusPath)) {
      try {
        status = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
      } catch (e) {
        console.error('Failed to parse status.json, resetting status.', e);
      }
    }

    if (status.last_notified_hash === currentHash) {
      console.log('Website hash unchanged. No action taken.');
      return;
    }

    // Send notification to ntfy
    console.log('Website content changed. Sending push notification...');
    const ntfyUrl = `https://ntfy.sh/${NTFY_TOPIC}`;
    
    // Construct message
    const message = 'TinoRunners site updated.';
    
    const notifyResponse = await fetch(ntfyUrl, {
      method: 'POST',
      body: message,
      headers: {
        'Title': 'TinoRunners Schedule Update',
        'Priority': 'high',
        'Tags': 'runner,calendar'
      }
    });

    if (!notifyResponse.ok) {
      throw new Error(`Failed to send notification: ${notifyResponse.status} ${notifyResponse.statusText}`);
    }

    console.log('Notification sent successfully!');

    // Update status.json
    status.last_notified_hash = currentHash;
    status.last_notified_week = currentWeek;
    status.last_notified_at = new Date().toISOString();
    fs.writeFileSync(statusPath, JSON.stringify(status, null, 2) + '\n');
    console.log('status.json updated.');

  } catch (error) {
    console.error('Error occurred:', error.message);
    process.exit(1);
  }
}

main();
