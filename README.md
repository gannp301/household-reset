# Household Reset

A cozy, mobile-friendly home management app: a weekly cleaning checklist, a household supplies list, and a daily cat-care checklist. It's a plain website made of HTML, CSS, and JavaScript. It doesn't use frameworks, accounts, a database, or paid services.

## Features

| Tab | What it does |
|-----|--------------|
| **Chores** | Weekly cleaning checklist with a progress bar. Add, edit, delete, and tick off chores. Weekly chores uncheck themselves every Monday. One-time chores disappear the week after you finish them. |
| **Supplies** | Household supplies checklist. Tick items when stocked, and use **Untick all supplies** before a shopping trip. |
| **Cats** | Daily care checklist for two cats. It unchecks itself each morning. |
| **History** | Your score for each past week, plus which chores you finished. Earlier weeks are never changed or lost when a new week starts. |

## Where your data is saved (please read)

Everything is saved in your browser's **localStorage**, a small storage space each website gets on your device.

- Your data **stays on the one device and browser** you used. Your iPad and your phone each keep their **own separate copy**, and the two **do not sync**.
- Clearing Safari's website data (Settings → Apps → Safari → Clear History and Website Data) **erases** your lists.
- In Private Browsing, nothing is saved after you close the tab.
- Nothing is sent to the internet. There's no account and no server.

## What each file does

| File | In plain English |
|------|------------------|
| `index.html` | The **skeleton** of the page: the title, the four tabs, the forms, and the empty lists the app fills in. |
| `styles.css` | The **look**: cream and blush pink colours, charcoal text, rounded cards, and big buttons that are easy to tap. All the colours are listed at the top, so they're easy to change. |
| `logic.js` | The **rules**, with no screen code. It works out which week it is, whether a chore is done "this week", the progress percentage, and how to keep history when a new week starts. |
| `app.js` | The **wiring**. It draws the lists, responds to taps (tick, add, edit, delete, switch tabs), and saves to localStorage. |
| `tests.html` | A **self-check page**. Open it in any browser and it runs 17 checks on `logic.js`, showing ✅ or ❌ for each. It doesn't touch your saved data. |
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
