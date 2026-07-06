const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const URL = 'https://tinorunners.org';
const NTFY_TOPIC = process.env.NTFY_TOPIC || 'tinorunners-updates-alert';

function hashContent(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function formatValue(value) {
  return value ? value : 'unknown';
}

function buildChangeSummary(previousStatus, currentSnapshot) {
  const changes = [];

  if (previousStatus.last_notified_week && previousStatus.last_notified_week !== currentSnapshot.week) {
    changes.push(`Week changed from ${previousStatus.last_notified_week} to ${currentSnapshot.week}`);
  }

  if (previousStatus.last_notified_updated && previousStatus.last_notified_updated !== currentSnapshot.lastUpdated) {
    changes.push(`Last updated changed from ${previousStatus.last_notified_updated} to ${currentSnapshot.lastUpdated}`);
  }

  if (previousStatus.last_notified_hash && previousStatus.last_notified_hash !== currentSnapshot.hash && changes.length === 0) {
    changes.push('Page content changed');
  } else if (previousStatus.last_notified_hash && previousStatus.last_notified_hash !== currentSnapshot.hash) {
    changes.push('Page content changed');
  }

  return changes.length > 0 ? changes : ['Page content changed'];
}

function buildNotificationBody(summaryLines, previousStatus, currentSnapshot) {
  const bodyLines = ['TinoRunners schedule update', ''];

  if (previousStatus.last_notified_week) {
    bodyLines.push(`Previous: ${previousStatus.last_notified_week}`);
  }

  bodyLines.push(`Current: ${currentSnapshot.week}`);

  if (previousStatus.last_notified_updated || currentSnapshot.lastUpdated) {
    bodyLines.push(
      `Last updated: ${formatValue(previousStatus.last_notified_updated)} -> ${formatValue(currentSnapshot.lastUpdated)}`
    );
  }

  bodyLines.push('', ...summaryLines);

  return bodyLines.join('\n');
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
    const historyPath = path.join(__dirname, 'history.jsonl');
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

    const currentSnapshot = {
      hash: currentHash,
      week: currentWeek,
      lastUpdated,
    };

    const summaryLines = buildChangeSummary(status, currentSnapshot);
    const message = buildNotificationBody(summaryLines, status, currentSnapshot);

    // Send notification to ntfy
    console.log('Website content changed. Sending push notification...');
    const ntfyUrl = `https://ntfy.sh/${NTFY_TOPIC}`;

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

    // Append the update to the history log.
    const historyEntry = {
      detected_at: new Date().toISOString(),
      previous: {
        hash: status.last_notified_hash || '',
        week: status.last_notified_week || '',
        last_updated: status.last_notified_updated || '',
      },
      current: currentSnapshot,
      summary: summaryLines,
    };
    fs.appendFileSync(historyPath, `${JSON.stringify(historyEntry)}\n`);
    console.log('history.jsonl appended.');

    // Update status.json
    status.last_notified_hash = currentHash;
    status.last_notified_week = currentWeek;
    status.last_notified_updated = lastUpdated;
    status.last_notified_at = new Date().toISOString();
    fs.writeFileSync(statusPath, JSON.stringify(status, null, 2) + '\n');
    console.log('status.json updated.');

  } catch (error) {
    console.error('Error occurred:', error.message);
    process.exit(1);
  }
}

main();
