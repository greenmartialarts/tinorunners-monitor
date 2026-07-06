# TinoRunners Update Monitor Cron

An automated, lightweight, and 100% free cron job that monitors [tinorunners.org](https://tinorunners.org) for schedule updates and sends instant push notifications to your iPhone.

---

## How It Works

1. **Scraping**: A Node.js script fetches the homepage of `tinorunners.org`.
2. **Hashing**: It computes a SHA-256 hash of the full page HTML and still extracts the current schedule week and last updated date for context.
3. **State Management**: The script reads `status.json`. If the current hash matches the last notified hash, it exits to avoid duplicate notifications.
4. **Change Summary**: When the site changes, it compares the current week and updated date against the previous checkpoint and builds a short summary of what changed.
5. **History Log**: Each detected update is appended to `history.jsonl` so you have an audit trail of every change.
6. **Notification**: It posts the comparison summary to **ntfy.sh** which instantly fires a push notification to the `ntfy` app on your iPhone.
7. **Update State**: It writes the new hash, week, and updated date back to `status.json` and commits the change back to the repository.

---

## iPhone Setup (ntfy)

We use **ntfy** (a free, open-source notification system) to send push notifications without requiring accounts or registration.

1. Download the **ntfy** app from the iOS App Store.
2. Tap **Subscribe to topic** in the app.
3. Enter your private topic name: `tinorunners-updates-9f4a7c8e`
4. Make sure notifications are enabled for the app.

---

## Deployment (GitHub Actions)

This project runs on a cron schedule using **GitHub Actions**.

### Trigger Modes
* **Hourly Schedule**: Automatically runs once every hour.
* **Manual Trigger**: Go to your GitHub repository -> **Actions** -> select **TinoRunners Monitor** -> click **Run workflow**.
* **On Push**: Automatically runs whenever code is pushed to the `main` branch.

### Permissions
The workflow automatically requests write access to commit changes back to `status.json`:
```yaml
permissions:
  contents: write
```
If your workflow runs fail with a permission error, go to **Settings** -> **Actions** -> **General** -> **Workflow permissions** in your GitHub repository and select **Read and write permissions**.

---

## Configuration & Customization

### Changing the Cron Schedule
You can adjust how frequently the script runs by modifying the cron expression in `.github/workflows/cron.yml` on line 6:
```yaml
  schedule:
    # Run every hour
    - cron: '0 * * * *'
```

* Run every 3 hours: `- cron: '0 */3 * * *'`
* Run once a day: `- cron: '0 0 * * *'`

### Setting a Custom Topic
If you ever want to change your ntfy topic name:
1. Open the ntfy app and subscribe to your new topic name.
2. Go to your GitHub Repository **Settings** -> **Secrets and variables** -> **Actions**.
3. Update the `NTFY_TOPIC` secret with your new topic name.

---

## Local Development

To test the script locally:
```bash
# Run with the default topic
node check.js

# Or test with a custom topic
NTFY_TOPIC=your-custom-topic node check.js
```

The `status.json` file stores the last notified website hash, plus the most recent week, updated date, and timestamp for reference. The `history.jsonl` file appends one JSON record per detected update.
