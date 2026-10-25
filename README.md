# Household Reset

A cozy, mobile-friendly home management app: a weekly cleaning checklist, a household supplies list, and a daily cat-care checklist. It's a plain website made of HTML, CSS, and JavaScript. It doesn't use frameworks, accounts, a database, or paid services.

## Features

| Tab | What it does |
|-----|--------------|
| **Chores** | Weekly cleaning checklist with a progress bar. Add, edit, delete, and tick off chores. Weekly chores uncheck themselves every Monday. One-time chores disappear the week after you finish them. |
| **Supplies** | Household supplies checklist. Tick items when stocked, and use **Untick all supplies** before a shopping trip. |
| **Cats** | Daily care checklist for two cats. It unchecks itself each morning. |
| **History** | Your score for each past week, plus which chores you finished. Earlier weeks are never changed or lost when a new week starts. |
| **Backup & Restore** | Shown under every tab. Download all your data as a dated `.json` file, and restore it later from that file. |

## Where your data is saved (please read)

Everything is saved in your browser's **localStorage**, a small storage space each website gets on your device.

- Your data **stays on the one device and browser** you used. Your iPad and your phone each keep their **own separate copy**, and the two **do not sync**.
- Clearing Safari's website data (Settings → Apps → Safari → Clear History and Website Data) **erases** your lists.
- In Private Browsing, nothing is saved after you close the tab.
- Nothing is sent to the internet. There's no account and no server.
- To keep a safe copy, or to move your lists to another device, use **Backup & Restore** (below).

## Back up and restore on iPad

### Make a backup

1. Open Household Reset in Safari and scroll down to **Backup & Restore**.
2. Tap **Download backup**. If Safari asks, tap **Download**.
3. The file is saved as something like `household-reset-backup-2026-10-25.json`. Find it in the **Files** app → **Downloads** (it may be under **On My iPad** or **iCloud Drive**).
4. Optional: move it somewhere safe, such as a folder in iCloud Drive or an email to yourself.

Tip: make a backup every week or two, and always before clearing Safari's website data.

### Restore from a backup

1. Open Household Reset and scroll down to **Backup & Restore**.
2. Tap **Restore from backup…**, then tap **Browse** (or **Choose File**) and pick your backup file in Files.
3. The app checks the file first:
   - If it isn't a Household Reset backup, or it's damaged, you'll see a red message and **nothing is changed**.
   - If it's valid, you'll see what the backup contains and a warning that restoring will **replace everything currently saved**.
4. Tap **Replace my data** to restore, or **Cancel** to keep your current data.

After a restore, the usual resets still apply: if the backup is from an earlier week, weekly chores show as unticked for this week and its earlier weeks appear in **History**. Cat tasks always start fresh each day.

To move your lists to your phone, make a backup on the iPad, open the file on the phone (for example via iCloud Drive or AirDrop), and restore it in Household Reset there. The two devices still won't sync automatically after that.

## What each file does

| File | In plain English |
|------|------------------|
| `index.html` | The **skeleton** of the page: the title, the four tabs, the forms, and the empty lists the app fills in. |
| `styles.css` | The **look**: cream and blush pink colours, charcoal text, rounded cards, and big buttons that are easy to tap. All the colours are listed at the top, so they're easy to change. |
| `logic.js` | The **rules**, with no screen code. It works out which week it is, whether a chore is done "this week", the progress percentage, and how to keep history when a new week starts. It also builds backup files and checks every part of a backup before it can be restored. |
| `app.js` | The **wiring**. It draws the lists, responds to taps (tick, add, edit, delete, switch tabs, back up, restore), and saves to localStorage. |
| `tests.html` | A **self-check page**. Open it in any browser and it runs 29 checks on `logic.js`, including backup checking and recovery, showing ✅ or ❌ for each. It doesn't touch your saved data. |
| `README.md` | This guide. |

## Preview the app

### On an iPad or phone (easiest: use GitHub Pages)

Safari can't open files from a GitHub repository directly, so the simplest way to see the app is to publish it with GitHub Pages (below). It's free and takes about a minute.

### On a computer

1. Download or clone the repository.
2. Open the `household-reset` folder and double-click `index.html`. It opens in your browser.
3. Double-click `tests.html` to run the self-checks.

## Publish with GitHub Pages (free)

You can do all of this in Safari on your iPad at github.com:

1. Open your repository on github.com.
2. Tap **Settings** (if you can't see it, tap the **···** menu first).
3. In the left menu, tap **Pages**.
4. Under **Build and deployment → Source**, choose **Deploy from a branch**.
5. Under **Branch**, choose `main` and the folder `/ (root)`, then tap **Save**.
6. Wait 1–2 minutes and refresh the page. A link appears at the top, like
   `https://YOUR-USERNAME.github.io/REPOSITORY-NAME/`.
7. Add `household-reset/` to the end of that link to open the app:
   `https://YOUR-USERNAME.github.io/REPOSITORY-NAME/household-reset/`
8. Optional: in Safari, tap **Share → Add to Home Screen** so it opens like an app.

> The app has to be on the `main` branch to be published this way. If your changes are still on another branch, merge its pull request into `main` first.

Run the self-checks online too: `…/household-reset/tests.html`.

## Make it your own

- **Change the colours:** edit the `--cream`, `--blush`, and `--charcoal` lines at the top of `styles.css`.
- **Change the starter lists:** edit `DEFAULT_CHORES`, `DEFAULT_SUPPLIES`, or `DEFAULT_PET_TASKS` in `logic.js`. These are only used the first time the app opens on a device, so the changes won't replace lists you've already saved.
- **Rename the cats:** use **Edit** on each cat task in the app. Names stay on your device.
