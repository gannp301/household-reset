# Household Reset

A cozy, mobile-friendly home management app: a room-by-room cleaning calendar, a laundry load tracker, a household supplies list, and a daily cat-care checklist. It's a plain website made of HTML, CSS, and JavaScript. It doesn't use frameworks, accounts, a database, or paid services.

## What's new in version 1.3

- **Supplies in collapsible categories:** Cleaning, Hair Care, Body Care, Laundry, Cat, Personal Care, and Other, plus your own. Each category header shows how many items it holds and how many are needed.
- **Notes on supplies:** for example, a preferred brand, scent, or who it's for.
- **Room chore lists in collapsible groups** by frequency (Weekly, Every 2 weeks, Monthly, Quarterly, As needed).
- **Edit chore** straight from the weekly checklist (**More → Edit chore**).
- **Laundry put-away reminders carry over:** a load finished in an earlier week and not put away is flagged until you put it away.
- Supplies are still simple: **ticked = stocked, unticked = needed**. There are no quantities or stock levels.

## What's new in version 1.2

- **Rooms instead of one long list.** Seven rooms (Bathroom, Kitchen, Living Room, Bedroom, Laundry, Cat Litter Room, Whole House), each with its own checklist and progress bar.
- **A Saturday–Friday cleaning calendar.** Move between weeks with ‹ and ›, and tap **Back to this week** to return.
- **Chores repeat on a schedule:** weekly, every 2 weeks, monthly, quarterly, or as needed.
- **Overdue chores are kept, not lost.** A missed chore stays on the list with its original due week until you do it or skip it.
- **Heads up** sums up what needs attention in the week you're viewing, in up to three short rows.
- **Get ready for next week** asks about supplies only for next week's chores that genuinely need them.
- **A laundry tracker** for one washer and one dryer, with a separate **Put away laundry** list.
- **Backups now include everything**, and version 1.1 backup files can still be restored.
- **Your version 1.1 data is kept safe.** See [What happens when you first open version 1.2](#what-happens-when-you-first-open-version-12).

## Features

| Tab | What it does |
|-----|--------------|
| **Rooms** | The cleaning calendar. Shows the week, totals (due, completed, overdue, next week), **Heads up**, a card for each room, and **Get ready for next week**. Tap a room card to open its checklist. |
| **Supplies** | Household supplies in collapsible categories, each with an optional note. Tick items when stocked, untick when needed, and use **Untick all supplies** before a shopping trip. |
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
| ⚠ **Overdue** | Amber | A scheduled chore whose week has ended and that still isn't done (including chores you chose **Skip for now** on). |

Chores that share a frequency are always due together. For example, **Deep clean shower/tub** and **Wash shower curtains** are both monthly, so they always land in the same week.

**Inside a room you can:**

- **Tick a chore** with the big round button. Tap it again to undo.
- Tap **More** on a chore for **Edit chore** and **Skip for now**. After you skip, the same panel offers an optional reason or note, **Add needed supply**, **Move to another cleaning week**, and **Undo Skip** (see *Skip for now* below).
- **Add a chore** with a name and a frequency.
- **Edit or delete** chores under **All chores in this room**. Deleting asks first, and past completions stay in History.

Changing how often a chore repeats starts its new schedule from the current week, so it never creates "overdue" chores in the past.

## How the cleaning calendar works

- A **cleaning week runs Saturday to Friday**. The app always opens on the current one.
- **‹ and ›** move to earlier or later weeks, and **Back to this week** jumps straight back. Looking at other weeks never changes anything.
- **There's no manual reset.** The app works out which chores are due in any week from their frequency. Each tick is saved for that chore and that week, so a new week simply starts empty.
- Weeks before you started using version 1.2 show "not tracked". Your older records are in **History → Version 1.1 archive**.

## How overdue chores work

- If a scheduled chore isn't done by Friday night, it **carries over automatically** and becomes **overdue**. It appears in its room under **Overdue**, with a simple **⚠ Overdue** label. The original due week is still saved and shown in History. No button is needed for this.
- The chore's next regular occurrence is still scheduled as normal. For example, an every-2-weeks mirror left from Oct 24 is overdue during Oct 31–Nov 6, and the next mirror is still due Nov 7–13. Finishing the overdue one doesn't tick the new one.
- **Looking ahead:** if you browse to a future week, chores that are still open now are shown under **Still open now**, labelled **Due this week** (they aren't overdue yet in real life). Browsing never makes anything overdue early.
- A missed chore **stays overdue** until you tick it. A new week's copy of the same chore doesn't replace or hide it.
- If you miss several weeks, each missed week is listed **once**. Nothing piles up twice.
- Ticking an overdue chore saves **today's date** as the real completion date and keeps the original due week, so History shows it as done late.
- Doing a chore late **doesn't shift its schedule**. An every-2-weeks chore stays on its rotation.
- **As-needed** chores are never overdue.
- Overdue chores also appear at the top of **Heads up** (see below).
- Reminders appear **inside the app only**. Household Reset can't send phone notifications.

## Skip for now

**Skip for now** means "not this week, but don't forget it".

- The chore stays **unfinished**. Its label says **Skipped for now**, and it still counts as unfinished in the room's progress.
- If the week ends and it still isn't done, it becomes **⚠ Overdue** and shows in the room's **Overdue** list, like any other missed chore.
- It keeps its **original scheduled week**. The next regular occurrence is a separate chore with its own tick, note, and skip. Doing the skipped one late never ticks the next one, and nothing is ever duplicated.
- **Undo Skip** puts it back exactly as it was before (it also cancels a move).
- **Move to another cleaning week** (shown after you skip) makes it due in that week instead. Its original week shows **Moved to Nov 7**. It only becomes overdue if *that* week passes. If the new week also has its own regular occurrence, both are listed separately, and ticking one leaves the other open.
- The optional **reason or note**, **Add needed supply**, and the move all belong to that one week's occurrence. A new occurrence starts with an empty note; older notes stay in History.

**Skips from older versions:** before version 1.3, "Skip" dismissed a chore for good. Those records are kept exactly as they were and are never rewritten. They're labelled **Skipped (dismissed)**, aren't overdue, and History lists them under **Skipped (dismissed in an older version)**. If you want one back, open **More** and tap **Undo skip (reopen)**; it then follows the normal overdue rules.

## Heads up

The **Heads up** card sums up the week shown in the week navigator. Its label always says which week that is, and whether it's this week, a past week, or a future week. It changes when you tap ‹ or ›.

It shows **at most three short rows**, most important first:

| Row | When viewing this week | When viewing another week |
|-----|------------------------|---------------------------|
| ⚠ **Overdue** (amber) | Missed chores from earlier weeks | Past week: that week's chores still not done. Future week: not shown. |
| ★ **Due Oct 31–Nov 6** | Every-2-weeks, monthly, and quarterly chores due this week | The same, for the week shown |
| ◷ **Coming next week: Nov 7–13** | Monthly and quarterly chores due next week | "Coming the week after", for the week after the one shown |

The line under the title says exactly what's summarized, for example **Summarizing Oct 31–Nov 6 · today's week**. When you browse, it says **a past week you're viewing (not today's week)** or **a future week you're viewing (not today's week)**. Expanded overdue details also show any note you left on a chore.

- Ordinary weekly chores aren't repeated here. They're already in each room. They only appear if they're overdue.
- Tap a row (or press Enter on it) to **Show details**. Inside, chores are grouped **by room**, and each room shows its count, for example **🛁 Bathroom 5**. Only rooms with something to show are listed. Tap a room to open it; several rooms can be open at once. Each chore shows its name, frequency, and a short label (**Overdue** or **Moved to Nov 7**).
- A chore is only ever listed under the week it actually belongs to.
- When nothing needs attention, it just says **All clear**.

## Supplies: categories and notes (version 1.3)

- **Categories:** tap a category header to open or close it. Several can be open at once, and each header shows "3 items · 1 needed". Categories with nothing in them start closed.
- **Adding:** type a name, pick a category, and tap **Add**. If the item is already on your list (capitals and spaces don't matter), it isn't added again. If it's ticked, you're offered **Mark as needed**.
- **Edit** a supply to rename it, add or change its **note**, or move it to another category. Moving keeps the same item, with the same tick and note, so nothing is duplicated.
- **Notes** (like "Brand X, for curly hair") stay when you tick or untick the item. To remove one, clear it in Edit.
- **Your own categories:** add one at the bottom of the tab. Each category has **Rename**, **↑ / ↓** to reorder it, and **Delete**. Deleting moves its supplies to **Other**; nothing is deleted. **Other** always stays last and can't be deleted.
- **Existing supplies** start in **Other**. The app never guesses a category from a name; you move items yourself.
- **Renaming a supply** also updates any chore that lists it (for example, "Glass cleaner" → "Window spray" on both mirror chores), and the app tells you so. Moving a supply doesn't affect chores at all.
- **Add needed supply** (from a chore or during a week review) can put a new item straight into a category. It goes in **Other** if you don't choose one.

## Rooms: chore groups and editing (version 1.3)

- **All chores in this room** is now grouped by frequency. Tap a group to open it; several can be open at once. Each group shows its chore count and colour, and keeps **Edit** and **Delete** inside it. Empty groups aren't shown.
- **Edit chore** is also in each chore's **More** panel in the weekly checklist. It opens the same form (name, frequency, supplies) right there. **Save Changes** saves and **Cancel** leaves everything as it was. Changing how often a chore repeats asks you to confirm first, and the new schedule starts this week, as before.
- Renaming keeps the same chore (and its history). History shows the name a chore had when it was done, for example **Wipe sink and counter (now "Wipe sink")**.

## Notes on chores

You can leave a short note on one occurrence of a chore, for example "I didn't have trash bags". Tap **More** on the chore and use **Add note**, or add it while finishing the week.

- The note belongs to that week's occurrence, not the chore itself, so next time starts fresh.
- The checklist only shows a small **📝 Note** marker. The full text appears under **More**, in expanded Heads up overdue details, and in History, where it stays even after the chore is done.
- Notes can be edited or cleared at any time.

## Finish Cleaning Week (optional)

An optional look back at a week. Use the **Finish Cleaning Week** button on the week card. It's available for this week and earlier weeks, not future ones.

1. It shows the Saturday–Friday dates and how many chores were **scheduled**, **completed**, and **unfinished**. Scheduled always equals completed plus unfinished.
2. A **room selector** shows each room with its number of unfinished chores. Rooms with nothing left show a **✓**. It starts on the first room that still has something to do, and the heading says **Reviewing: Bathroom** (or whichever room). **All rooms** is there if you'd rather see everything at once. Switching rooms keeps your choices and notes.
3. Each unfinished chore has exactly **two choices**:
   - **Carry Over** (the default) leaves the chore open. It becomes overdue after the week ends, keeps its original due date, and the schedule doesn't change. You can add an optional note.
   - **Done** marks it complete with today's date.
4. **Review summary** covers all rooms: how many chores will be marked Done or carried over, notes changed, and supplies changed. Tap **Confirm**, or **Go Back** to change something.

**If everything is done**, the review just says **All done**. Chores you marked Done in an earlier save of the review are kept in a collapsed, labelled list (**Marked Done in this review**), so you can change your mind. Chores you ticked in the normal checklist are never listed; they simply stay completed.

**Editing or undoing a review:**
- **Edit week review** reopens it with your saved choices.
- **Undo week review** (it asks first) removes only the "reviewed" status and date, so **Finish Cleaning Week** is available again. Your ticked chores, completion dates (including chores marked Done through the review), notes, supplies, and overdue chores all stay exactly as they are.

The review never clears the checklist, never locks the week, and never changes schedules. Weeks move on by themselves whether or not you use it.

## Add needed supply

Open a chore's **More** panel in any room, or the **+ Add needed supply** section of a carried-over chore in Finish Cleaning Week.

- **Suggested supplies** lists any supplies linked to that chore. Tapping one only fills in the name; nothing is chosen for you.
- You can type any supply name.
- Nothing is added until you tap the button:
  - **Add to Supplies** for a new item, which is added unticked (needed).
  - **Mark as needed** if the item is already on your list and ticked.
  - **Already needed** (greyed out) if it's already on the list and unticked, so nothing is ever added twice. Capitals and extra spaces don't matter.
- **Supply changes happen immediately**, the moment you tap the button. A green **✓ Added…** or **✓ Marked…** message confirms it, even during Finish Cleaning Week. They don't wait for the review's Confirm, and cancelling the review doesn't remove them. The review summary just counts them as "already saved".

## Get ready for next week

This card looks only at **next week** (the next Saturday to Friday) and only at chores that genuinely need a supply, for example **Change scent booster plugins** → **Scent plugin refills**. Everyday chores never ask questions.

- Each supply is asked about once, even if several chores need it, for example "Do you have Glass cleaner?" for both mirrors.
- **I'm stocked** saves your answer.
- **Add to supplies** puts the item on your Supplies list as needed (unticked). If it's already on the list, the button says **Mark as needed** instead, so nothing is added twice.
- Being on the Supplies list never counts as "in stock". The question is still asked, and it shows whether the item is ticked.
- Answers are saved for that specific chore occurrence, so they don't come back after a refresh. The same chore's next occurrence asks again.
- **Change answer** undoes it: the question comes back, items it added are removed (unless another answer still uses them), and items it marked get their old tick back. If you've changed one of those items on the Supplies tab since (for example, ticked it after buying it), undo leaves it alone and tells you so.
- Supply links that came with the app (like scent plugin refills) are added to older saved data the first time it loads. A chore whose supplies you've edited, or cleared, is never changed.
- Tap the heading to collapse or expand the card. It opens by itself when something needs checking.
- To give any chore its own supplies, open its room → **All chores in this room** → **Edit**, and fill in **Supplies it needs** (separate items with commas).

## Laundry tracking

Open the **Laundry** room card.

1. Choose a category (**Regular clothes**, **Bedding**, or **Towels & throw blankets**), optionally type a name, and tap **Add load**. You can add as many loads per category as you like.
2. Each load moves through four steps: **Waiting to wash → In washer → In dryer → Finished**. Tap the big button on a load to move it to the next step.
3. There's **one washer and one dryer**. If one is busy, the button for moving another load into it is greyed out, with a note saying which load is in the way.
4. Need more drying? Tap **Dry again**. It works while the load is in the dryer, and also after it's finished (if the dryer is free).
5. Made a mistake? **Back a step** moves a load backwards. **Rename** and **Delete** are there too.
6. A load counts as **finished as soon as it's out of the dryer**, whether or not it's folded.
7. **Put away laundry** lists finished loads still to be put away. Tap **Mark put away** on each one. This doesn't change its finished status. **Clear put-away loads** tidies the board; cleared loads are kept in History and backups.

**Put-away reminders from earlier weeks:** if a load finished in an earlier cleaning week still isn't put away, it's listed under **⚠ From earlier weeks** in **Put away laundry**, labelled with its week and finish date (for example, "from the week of Oct 24 (finished Oct 25)"). The Laundry room card also flags it. It's the same load, not a copy, so **Mark put away** clears the reminder straight away. It stays until you do. Loads still in the washer or dryer never count, and these reminders don't change room chore counts.

**Browsing vs. the real date:** reminders follow the real date, not the week you're viewing.

| What you're doing | What Laundry and the room card show |
|-------------------|-------------------------------------|
| Viewing this week | Loads finished in an earlier week and not put away: **⚠ Overdue · put away (finished Oct 25)**. A load finished this week isn't overdue yet. |
| Viewing a past week | The same real, current reminders. Looking back never hides or adds any. |
| Viewing a future week | Also lists loads that *would still be waiting* then, labelled **Not put away yet (finished Oct 25)**, not Overdue. Browsing saves nothing. |
| A new week actually starts (the date moves on) | Any load finished in an earlier week becomes **⚠ Overdue** and the Laundry room card flags it, one week late or several, listed once. |

The counters at the top describe the loads **on the board right now**: **waiting**, **started** (in the washer, dryer, or finished), **moved to the dryer** (in the dryer or finished), **finished**, and **still to put away**. When you clear put-away loads, they leave the board, so these counters go down. Below them, **Finished this cleaning week** counts every load finished since Saturday, *including* loads you've already cleared, so that number never drops when you tidy up.

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
- **If the old data is damaged**, the app does **not** start fresh by itself. It shows a message and saves nothing until you choose one of these:
  - **Restore from a backup**: pick a backup file.
  - **Download the old data**: saves an exact copy of what's stored, damaged or not, so you can keep it or share it for help.
  - **Start fresh** (or **Use my version 1.1 lists**, if only the version 1.2 data is damaged): asks you to confirm first. The damaged data stays stored.
- **If the browser can't read its storage at all**, the app saves nothing that session, so it can't overwrite data it couldn't see. Try closing and reopening Safari, and don't use Private Browsing.

A message at the top of the Rooms tab tells you when the upgrade has happened. **Recommended:** before the update goes live, open the current app and tap **Download backup**, so you have your own copy as well.

## Back up and restore on iPad

### Make a backup

1. Open Household Reset in Safari and scroll down to **Backup & Restore**.
2. Tap **Download backup**. If Safari asks, tap **Download**.
3. The file is saved as something like `household-reset-backup-2026-10-25.json`. Find it in the **Files** app → **Downloads** (it may be under **On My iPad** or **iCloud Drive**).
4. Optional: move it somewhere safe, such as a folder in iCloud Drive or an email to yourself.

A version 1.2 backup contains your rooms' chores and schedules (including the supplies each chore needs), every completion, skip, and move (with dates), as-needed history, next-week prep answers, laundry loads, supplies, cat care, and the version 1.1 archive. Backups made before these were added still restore normally.

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

If the backup has a **different version** of a week or chore that's already in your archive (a "conflict"), the box names it, for example "Keep your archived version of 1 week (week of Oct 12, 2026)". Your archived version is always kept, and the backup's version of that item isn't imported.

**A restore only counts once it's saved.** If Safari can't save it (for example, storage is full), you'll see a red message and your previous data stays exactly as it was, both on screen and in storage.

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
| `schedule.js` | **Calendar rules** *(new)*: Saturday–Friday weeks, the approved room chore lists, when each frequency is due, overdue and upcoming chores, the Heads up summary, and adding, editing, deleting, skipping, and moving chores. |
| `laundry.js` | **Laundry rules** *(new)*: the four steps, one washer and one dryer, extra drying, and put-away tracking. |
| `storage.js` | **Saving and safety** *(new)*: the version 1.2 data format, the one-time upgrade from 1.1, loading and saving, and checking backups before restoring. |
| `review.js` | **Finish Cleaning Week** *(new)*: the review screen's counts, the Carry Over / Done choices, notes, and supplies, applied only when you confirm. |
| `supplies.js` | **Supply categories and notes** *(new in 1.3)*: categories (add, rename, reorder, delete), moving supplies, notes, and renaming with chore links kept. |
| `prep.js` | **Next-week prep** *(new)*: finds next week's chores that need supplies, and handles **I'm stocked**, **Add to supplies**, and undo without duplicates. |
| `logic.js` | **Supplies and cat-care rules**, plus the version 1.1 backup checker (unchanged from version 1.1). |
| `app.js` | The **wiring**: draws every screen, responds to taps, and saves changes. |
| `tests.html` | The **self-check page**: runs every automatic test and lists the manual checks. |
| `tests-v1-2.js` | The **version 1.2 tests**, loaded by `tests.html`. |
| `tests-v1-3.js` | The **version 1.3 tests** *(new)*, loaded by `tests.html`. |
| `README.md` | This guide. |

## New programming ideas in version 1.2

- **Data migration:** changing saved data from an old format to a new one. The safe recipe is to read the old data, build the new data in memory, save it under a new name, and leave the old data alone.
- **Idempotent:** an action that gives the same result however many times it runs. The upgrade checks for new data first, so running it again does nothing. Restoring the same older backup twice is idempotent too.
- **Merge vs. replace:** restoring a version 1.1 backup *merges* (it changes only the parts the file knows about). Restoring a version 1.2 backup *replaces*, because the file contains everything.
- **Calculated, not stored:** the app doesn't store "Clean toilet, week of Nov 7: not done". It *calculates* what's due from the frequency rule and only stores what you actually did. That's why viewing other weeks can't change anything.
- **Day numbers:** dates are turned into "days since 1970" for maths, which avoids clock problems like daylight-saving time.
- **Validation:** checking every part of data (like a backup file) before trusting it, so a damaged file is refused instead of breaking the app.
- **Optional fields:** new data (chore supplies, prep answers) was added as *optional*, so older data and backups that don't have it are still valid. No extra migration is needed.
- **Built-in disclosure (`<details>`):** the Heads up rows and the prep card use the browser's own show/hide element, which works with taps, the keyboard (Enter), and screen readers without extra code.
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
