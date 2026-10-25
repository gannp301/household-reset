# Household Reset

A cozy, mobile-friendly home management app: a room-by-room cleaning calendar, a laundry load tracker, a household supplies list, and a daily cat-care checklist. It's a plain website made of HTML, CSS, and JavaScript. It doesn't use frameworks, accounts, a database, or paid services.

## What's new in version 1.2

- **Rooms instead of one long list.** Seven rooms (Bathroom, Kitchen, Living Room, Bedroom, Laundry, Cat Litter Room, Whole House), each with its own checklist and progress bar.
- **A Saturday–Friday cleaning calendar.** Move between weeks with ‹ and ›, and tap **Back to this week** to return.
- **Chores repeat on a schedule:** weekly, every 2 weeks, monthly, quarterly, or as needed.
- **Overdue chores are kept, not lost.** A missed chore stays on the list with its original due week until you do it or skip it.
- **Reminders and Upcoming** show what's due now, what's due next week, and when the less-frequent chores come round.
- **A laundry tracker** for one washer and one dryer, with a separate **Put away laundry** list.
- **Backups now include everything**, and version 1.1 backup files can still be restored.
- **Your version 1.1 data is kept safe.** See [What happens when you first open version 1.2](#what-happens-when-you-first-open-version-12).

## Features

| Tab | What it does |
|-----|--------------|
| **Rooms** | The cleaning calendar. Shows the week, totals (due, completed, overdue, coming up), reminders, a card for each room, and an Upcoming list. Tap a room card to open its checklist. |
| **Supplies** | Household supplies checklist (unchanged). Tick items when stocked, and use **Untick all supplies** before a shopping trip. |
| **Cats** | Daily care checklist for two cats (unchanged). It unchecks itself each morning. |
| **History** | Each past cleaning week: what was done (and on what date), skipped, or missed, plus laundry loads finished. Below that is the **Version 1.1 archive** with your old weekly scores. |
| **Backup & Restore** | Shown under every tab. Download all your data as a dated `.json` file, and restore it later. |

## How room scheduling works

Every chore belongs to a room and has a **frequency**. Each frequency has its own colour, icon, and label, so you can tell them apart even without colour:

| Frequency | Colour | When it's due |
|-----------|--------|---------------|
| ↻ **Weekly** | Sage green | Every cleaning week. |
| ⇄ **Every 2 weeks** | Lavender | Every second week on a fixed rotation. The starting chores are due in the weeks of Oct 24, Nov 7, Nov 21 2026, and so on. When you add an every-2-weeks chore, you can pick that rotation or the other one (Oct 31, Nov 14, …). |
| ◐ **Monthly** | Muted blue | The week that starts on the **first Saturday of each month**. For example, Nov 7 2026, Dec 5 2026, Jan 2 2027. |
| ◆ **Quarterly** | Warm taupe | The week that starts on the first Saturday of **January, April, July, and October**. |
| ○ **As needed** | Neutral grey | Never scheduled and never overdue. Tap it whenever you do it, and the app remembers when it was last done. |
| ⚠ **Overdue** | Amber | A scheduled chore from an earlier week that hasn't been done or skipped. |

Chores that share a frequency are always due together. For example, **Deep clean shower/tub** and **Wash shower curtains** are both monthly, so they always land in the same week.

**Inside a room you can:**

- **Tick a chore** with the big round button. Tap it again to undo.
- Tap **More** on a chore to **skip** it for that week or **move** it to a later week (this is "rescheduling" one occurrence).
- **Add a chore** with a name and a frequency.
- **Edit or delete** chores under **All chores in this room**. Deleting asks first, and past completions stay in History.

Changing how often a chore repeats starts its new schedule from the current week, so it never creates "overdue" chores in the past.

## How the cleaning calendar works

- A **cleaning week runs Saturday to Friday**. The app always opens on the current one.
- **‹ and ›** move to earlier or later weeks, and **Back to this week** jumps straight back. Looking at other weeks never changes anything.
- **There's no manual reset.** The app works out which chores are due in any week from their frequency. Each tick is saved for that chore and that week, so a new week simply starts empty.
- Weeks before you started using version 1.2 show "not tracked". Your older records are in **History → Version 1.1 archive**.

## How overdue chores work

- If a scheduled chore isn't done by Friday night, it becomes **overdue**. It appears in its room under **Overdue from earlier weeks**, labelled with the week it was originally due.
- A missed chore **stays overdue** until you tick it or skip it. A new week's copy of the same chore doesn't replace or hide it.
- If you miss several weeks, each missed week is listed **once**. Nothing piles up twice.
- Ticking an overdue chore saves **today's date** as the real completion date and keeps the original due week, so History shows it as done late.
- Doing a chore late **doesn't shift its schedule**. An every-2-weeks chore stays on its rotation.
- Back from a trip? **Skip all overdue in this room** clears a room in one tap, after asking first. Skipped chores are recorded as skipped, not done.
- **As-needed** chores are never overdue.
- Reminders appear **inside the app only**. Household Reset can't send phone notifications.

## Laundry tracking

Open the **Laundry** room card.

1. Choose a category (**Regular clothes**, **Bedding**, or **Towels & throw blankets**), optionally type a name, and tap **Add load**. You can add as many loads per category as you like.
2. Each load moves through four steps: **Waiting to wash → In washer → In dryer → Finished**. Tap the big button on a load to move it to the next step.
3. There's **one washer and one dryer**. If one is busy, the button for moving another load into it is greyed out, with a note saying which load is in the way.
4. Need more drying? Tap **Dry again**. It works while the load is in the dryer, and also after it's finished (if the dryer is free).
5. Made a mistake? **Back a step** moves a load backwards. **Rename** and **Delete** are there too.
6. A load counts as **finished as soon as it's out of the dryer**, whether or not it's folded.
7. **Put away laundry** lists finished loads still to be put away. Tap **Mark put away** on each one. This doesn't change its finished status. **Clear put-away loads** tidies the board; cleared loads are kept in History and backups.

The counters at the top show how many loads are **waiting**, **started**, **moved to the dryer**, **finished**, and **still to put away**.

Laundry and room chores are tracked separately. Finishing a bedding or towel load does **not** tick off "Strip bedding & wash sheets/comforter", "Wash kitchen towels", or "Wash throw blankets". Tick those yourself.

## Where your data is saved (please read)

Everything is saved in your browser's **localStorage**, a small storage space each website gets on your device.

- Your data **stays on the one device and browser** you used. Your iPad and your phone each keep their **own separate copy**, and the two **do not sync**.
- Clearing Safari's website data (Settings → Apps → Safari → Clear History and Website Data) **erases** your lists.
- In Private Browsing, nothing is saved after you close the tab.
- Nothing is sent to the internet. There's no account and no server.
- To keep a safe copy, or to move your lists to another device, use **Backup & Restore** (below).

## What happens when you first open version 1.2

The first time version 1.2 opens on a device that already has version 1.1 data, it **upgrades** ("migrates") that data once:

| Your version 1.1 data | What happens in 1.2 |
|-----------------------|---------------------|
| Supplies | Kept exactly as they were. |
| Cat-care tasks | Kept exactly as they were. |
| Weekly scores (History) | Moved into the read-only **Version 1.1 archive** in History. |
| Old chore list | Also in the archive, for reference. The old general chores (like "Vacuum floors") are **not** copied into the new rooms, so nothing appears twice. |
| New room chores | Start fresh with the approved room lists. No past completions are invented, and nothing is overdue from before the upgrade. |

How it keeps your data safe:

- Version 1.2 saves under a **new storage name** (`householdReset.v2`). Version 1.1's data (`householdReset.v1`) is only read, **never changed or deleted**, so it's still there if anything goes wrong.
- The upgrade happens **only once**. Opening or refreshing the app again uses the version 1.2 data and never re-copies anything.
- The new data is built completely in memory and saved in one step, so an interrupted upgrade can't leave half-saved data.
- If the old data can't be read, the app explains that and starts fresh, and the old data still stays untouched.

A message at the top of the Rooms tab tells you when the upgrade has happened. **Recommended:** before the update goes live, open the current app and tap **Download backup**, so you have your own copy as well.

## Back up and restore on iPad

### Make a backup

1. Open Household Reset in Safari and scroll down to **Backup & Restore**.
2. Tap **Download backup**. If Safari asks, tap **Download**.
3. The file is saved as something like `household-reset-backup-2026-10-25.json`. Find it in the **Files** app → **Downloads** (it may be under **On My iPad** or **iCloud Drive**).
4. Optional: move it somewhere safe, such as a folder in iCloud Drive or an email to yourself.

A version 1.2 backup contains your rooms' chores and schedules, every completion, skip, and move (with dates), as-needed history, laundry loads, supplies, cat care, and the version 1.1 archive.

Tip: make a backup every week or two, and always before clearing Safari's website data.

### Restore from a backup

1. Open Household Reset and scroll down to **Backup & Restore**.
2. Tap **Restore from backup…**, then tap **Browse** (or **Choose File**) and pick your backup file in Files.
3. The app checks the file first:
   - If it isn't a Household Reset backup, or it's damaged, you'll see a red message and **nothing is changed**.
   - If it's valid, you'll see what the backup contains and exactly what restoring will change.
4. Tap the red button (**Replace my data**, or **Restore older backup** for a version 1.1 file) to restore, or **Cancel** to keep your current data.

### Restoring an older (version 1.1) backup

Version 1.1 backup files still work. A 1.1 backup only contains supplies, cat care, and the old chore list and history, so restoring one **only changes those parts**:

| Part of your data | What a version 1.1 backup does |
|-------------------|--------------------------------|
| Supplies and Cats | **Replaced** by the backup's lists. |
| Old chores and weekly scores | **Added** to History → Version 1.1 archive. Weeks and chores already there are kept as they are, and nothing is added twice. |
| Room chores, schedules, completion history | **Kept** exactly as they are. |
| Laundry loads | **Kept** exactly as they are. |

The confirmation box lists exactly what will be replaced, added, and kept before anything changes. Restoring the same 1.1 backup twice changes nothing the second time.

A **version 1.2** backup is different: it contains everything, so restoring it replaces everything, including laundry loads. Its confirmation box says so.

To move your lists to your phone, make a backup on the iPad, open the file on the phone (for example via iCloud Drive or AirDrop), and restore it in Household Reset there. The two devices still won't sync automatically after that.

## Test the app on an iPad

1. **Automatic self-checks:** open `tests.html` (for example `…/household-reset/tests.html` on your published site). The top line should say **"All … automatic tests passed"**, with results grouped by topic. This page uses made-up sample data and never touches your saved lists.
2. **Manual checks:** the same page ends with a short list of things only a person can check, like tapping buttons and downloading a backup. Work through them in Safari.
3. If anything shows ❌, take a screenshot and share it.

## What each file does

| File | In plain English |
|------|------------------|
| `index.html` | The **skeleton** of the page: the title, the four tabs, the week navigator, and the empty areas the app fills in. |
| `styles.css` | The **look**: cream and blush pink with charcoal text, the frequency colours, rounded cards, and big buttons that are easy to tap. All colours are listed at the top. |
| `schedule.js` | **Calendar rules** *(new)*: Saturday–Friday weeks, the approved room chore lists, when each frequency is due, overdue and upcoming chores, and adding, editing, deleting, skipping, and moving chores. |
| `laundry.js` | **Laundry rules** *(new)*: the four steps, one washer and one dryer, extra drying, and put-away tracking. |
| `storage.js` | **Saving and safety** *(new)*: the version 1.2 data format, the one-time upgrade from 1.1, loading and saving, and checking backups before restoring. |
| `logic.js` | **Supplies and cat-care rules**, plus the version 1.1 backup checker (unchanged from version 1.1). |
| `app.js` | The **wiring**: draws every screen, responds to taps, and saves changes. |
| `tests.html` | The **self-check page**: runs every automatic test and lists the manual checks. |
| `tests-v1-2.js` | The **version 1.2 tests** *(new)*, loaded by `tests.html`. |
| `README.md` | This guide. |

## New programming ideas in version 1.2

- **Data migration:** changing saved data from an old format to a new one. The safe recipe is to read the old data, build the new data in memory, save it under a new name, and leave the old data alone.
- **Idempotent:** an action that gives the same result however many times it runs. The upgrade checks for new data first, so running it again does nothing. Restoring the same older backup twice is idempotent too.
- **Merge vs. replace:** restoring a version 1.1 backup *merges* (it changes only the parts the file knows about). Restoring a version 1.2 backup *replaces*, because the file contains everything.
- **Calculated, not stored:** the app doesn't store "Clean toilet, week of Nov 7: not done". It *calculates* what's due from the frequency rule and only stores what you actually did. That's why viewing other weeks can't change anything.
- **Day numbers:** dates are turned into "days since 1970" for maths, which avoids clock problems like daylight-saving time.
- **Validation:** checking every part of data (like a backup file) before trusting it, so a damaged file is refused instead of breaking the app.
- **A state machine:** something that can only be in certain states with certain moves between them, like a laundry load going waiting → washer → dryer → finished.

## Preview the app

### On an iPad or phone

The live app is published from the `main` branch with GitHub Pages (below). Changes on another branch don't appear on the live site until their pull request is merged.

### On a computer

1. Download or clone the repository.
2. Open the `household-reset` folder and double-click `index.html`. It opens in your browser.
3. Double-click `tests.html` to run the self-checks.

## Publish with GitHub Pages (free)

### First-time setup

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

### Publishing an update (like version 1.2)

1. **Back up first:** open the live app and tap **Download backup**.
2. Review the update's pull request on GitHub (**Files changed** tab).
3. When you're happy, tap **Merge pull request** → **Confirm merge**.
4. GitHub Pages republishes from `main` within a few minutes. You can watch progress in the repository's **Actions** tab.
5. Reload the app in Safari. If it still looks old, wait a minute and reload again.
6. Open `…/household-reset/tests.html` and check every automatic test passes.

## Make it your own

- **Change the colours:** edit the colour lines at the top of `styles.css`.
- **Change the starter room chores:** edit `DEFAULT_TASKS` in `schedule.js`. These are only used when the app first creates version 1.2 data, so they won't replace chores you've already saved.
- **Change supplies or cat tasks:** use **Add**, **Edit**, and **Delete** in the app.
- **Rename the cats:** use **Edit** on each cat task in the app. Names stay on your device.
