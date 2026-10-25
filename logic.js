/*
 * logic.js — the "rules" of Household Reset.
 *
 * Nothing in this file touches the web page. It only works with plain data
 * (lists of chores, supplies, and pet tasks), which makes it easy to test
 * in tests.html.
 */
(function (global) {
  'use strict';

  var STORAGE_VERSION = 1;

  var DEFAULT_CHORES = [
    'Vacuum floors',
    'Mop floors',
    'Dust surfaces',
    'Clean the shower',
    'Clean the microwave',
    'Take out trash',
    'Take out recycling',
    'Strip and change beds',
    'Tidy the bedroom',
    'Wipe nightstands',
    'Clear the dining table'
  ];

  var DEFAULT_SUPPLIES = [
    'Dish soap',
    'Laundry detergent',
    'Paper towels',
    'Toilet paper',
    'Trash bags',
    'Recycling bags',
    'All-purpose cleaner',
    'Sponges',
    'Cat food',
    'Cat litter'
  ];

  // Daily tasks for two cats. These reset every morning.
  var DEFAULT_PET_TASKS = [
    'Feed Cat 1 breakfast',
    'Feed Cat 2 breakfast',
    'Feed Cat 1 dinner',
    'Feed Cat 2 dinner',
    'Fresh water in bowls',
    'Scoop the litter box',
    'Playtime with both cats'
  ];

  // Adds a leading zero: 7 -> "07".
  function pad2(n) {
    return (n < 10 ? '0' : '') + n;
  }

  // A short random id so each item can be found again later.
  function makeId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // Returns a label for the week a date falls in, e.g. "2026-W43".
  // Weeks start on Monday (the ISO 8601 standard).
  function weekKey(date) {
    var d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    var dayNumber = d.getUTCDay() || 7; // Sunday counts as day 7
    d.setUTCDate(d.getUTCDate() + 4 - dayNumber); // jump to that week's Thursday
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    var week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
    return d.getUTCFullYear() + '-W' + pad2(week);
  }

  // Returns a label for a single day, e.g. "2026-10-24".
  function dayKey(date) {
    return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
  }

  // Returns the Monday of the week a date falls in, as "2026-10-19".
  function weekStartDay(date) {
    var monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    var dayNumber = monday.getDay() || 7;
    monday.setDate(monday.getDate() - (dayNumber - 1));
    return dayKey(monday);
  }

  function createChore(name, recurring) {
    return { id: makeId(), name: name, recurring: recurring !== false, doneWeek: null };
  }

  function createSupply(name) {
    return { id: makeId(), name: name, done: false };
  }

  function createPetTask(name) {
    return { id: makeId(), name: name, doneDay: null };
  }

  // The starting data the very first time someone opens the app.
  function createDefaultState() {
    return {
      version: STORAGE_VERSION,
      chores: DEFAULT_CHORES.map(function (name) { return createChore(name, true); }),
      supplies: DEFAULT_SUPPLIES.map(createSupply),
      pets: DEFAULT_PET_TASKS.map(createPetTask),
      history: {}
    };
  }

  // A chore counts as done only if it was finished during *this* week.
  // This one rule is what makes recurring chores reset every Monday.
  function isChoreDone(chore, week) {
    return chore.doneWeek === week;
  }

  function isPetTaskDone(task, day) {
    return task.doneDay === day;
  }

  function toggleChore(chore, week) {
    chore.doneWeek = isChoreDone(chore, week) ? null : week;
  }

  function togglePetTask(task, day) {
    task.doneDay = isPetTaskDone(task, day) ? null : day;
  }

  function toggleSupply(item) {
    item.done = !item.done;
  }

  // Counts how many chores are done this week.
  function weeklyProgress(chores, week) {
    var done = chores.filter(function (c) { return isChoreDone(c, week); }).length;
    var total = chores.length;
    var percent = total === 0 ? 0 : Math.round((done / total) * 100);
    return { done: done, total: total, percent: percent };
  }

  // Saves a snapshot of this week's score in state.history.
  // Earlier weeks are never touched, so their records are kept.
  function recordWeek(state, now) {
    var week = weekKey(now);
    var progress = weeklyProgress(state.chores, week);
    state.history[week] = {
      weekStart: weekStartDay(now),
      done: progress.done,
      total: progress.total,
      completed: state.chores
        .filter(function (c) { return isChoreDone(c, week); })
        .map(function (c) { return c.name; })
    };
    return state;
  }

  // Runs when the app opens. One-time chores that were finished in an
  // earlier week are removed (their completion already lives in history).
  // Recurring chores stay and simply show as "not done" for the new week.
  function rollover(state, now) {
    var week = weekKey(now);
    state.chores = state.chores.filter(function (c) {
      var finishedEarlier = c.doneWeek !== null && c.doneWeek !== week;
      return c.recurring || !finishedEarlier;
    });
    return recordWeek(state, now);
  }

  // Past weeks only (not the current one), newest first.
  function pastWeeks(state, now) {
    var current = weekKey(now);
    return Object.keys(state.history)
      .filter(function (key) { return key !== current; })
      .sort()
      .reverse()
      .map(function (key) {
        var entry = state.history[key];
        return {
          week: key,
          weekStart: entry.weekStart,
          done: entry.done,
          total: entry.total,
          completed: entry.completed || []
        };
      });
  }

  // Turns saved text back into app data. If the text is missing or broken,
  // it starts fresh instead of crashing.
  function parseState(text) {
    if (!text) return createDefaultState();
    try {
      var data = JSON.parse(text);
      if (!data || !Array.isArray(data.chores) || !Array.isArray(data.supplies) ||
          !Array.isArray(data.pets) || typeof data.history !== 'object' || data.history === null) {
        return createDefaultState();
      }
      return data;
    } catch (err) {
      return createDefaultState();
    }
  }

  // Cleans up a name typed by the user. Returns "" if it's empty.
  function cleanName(text) {
    return String(text || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  }

  // ---------- Backup & Restore ----------

  var BACKUP_APP = 'household-reset';
  var BACKUP_VERSION = 1;
  var MAX_BACKUP_CHARACTERS = 2000000; // about 2 MB, far more than real lists need

  // Wraps all saved data with a label, so a restore can recognise the file.
  function createBackup(state, now) {
    return {
      app: BACKUP_APP,
      backupVersion: BACKUP_VERSION,
      exportedAt: now.toISOString(),
      data: state
    };
  }

  // A dated file name, e.g. "household-reset-backup-2026-10-25.json".
  function backupFileName(now) {
    return 'household-reset-backup-' + dayKey(now) + '.json';
  }

  function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function isTextOrNull(value) {
    return value === null || typeof value === 'string';
  }

  function isCount(value) {
    return typeof value === 'number' && value >= 0 && Math.floor(value) === value;
  }

  // Checks every item in a list and copies only the fields the app uses.
  // Returns null if any item is broken.
  function checkItems(list, copyExtraFields) {
    if (!Array.isArray(list)) return null;
    var copies = [];
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      if (!isPlainObject(item) || typeof item.id !== 'string' || item.id === '') return null;
      var name = cleanName(item.name);
      if (typeof item.name !== 'string' || !name) return null;
      var extra = copyExtraFields(item);
      if (!extra) return null;
      var copy = { id: item.id, name: name };
      Object.keys(extra).forEach(function (key) { copy[key] = extra[key]; });
      copies.push(copy);
    }
    return copies;
  }

  function checkHistory(history) {
    if (!isPlainObject(history)) return null;
    var copy = {};
    var weeks = Object.keys(history);
    for (var i = 0; i < weeks.length; i++) {
      var week = weeks[i];
      var entry = history[week];
      if (!/^\d{4}-W\d{2}$/.test(week) || !isPlainObject(entry)) return null;
      if (!isCount(entry.done) || !isCount(entry.total) || entry.done > entry.total) return null;
      if (typeof entry.weekStart !== 'string') return null;
      var completed = entry.completed === undefined ? [] : entry.completed;
      if (!Array.isArray(completed) || completed.some(function (n) { return typeof n !== 'string'; })) return null;
      copy[week] = { weekStart: entry.weekStart, done: entry.done, total: entry.total, completed: completed.slice() };
    }
    return copy;
  }

  // Reads the text of a backup file and checks every part of it.
  // Returns { ok: true, state, summary } if it's safe to restore,
  // or { ok: false, error } explaining what's wrong. It never saves anything.
  function validateBackup(text) {
    var notBackup = "This file isn't a Household Reset backup.";
    if (typeof text !== 'string' || text.trim() === '') {
      return { ok: false, error: 'This file is empty.' };
    }
    if (text.length > MAX_BACKUP_CHARACTERS) {
      return { ok: false, error: 'This file is too large to be a Household Reset backup.' };
    }
    var file;
    try {
      file = JSON.parse(text);
    } catch (err) {
      return { ok: false, error: notBackup + ' It could not be read as JSON.' };
    }
    if (!isPlainObject(file) || file.app !== BACKUP_APP || !isPlainObject(file.data)) {
      return { ok: false, error: notBackup };
    }
    if (typeof file.backupVersion !== 'number' || file.backupVersion > BACKUP_VERSION) {
      return { ok: false, error: 'This backup was made by a newer version of Household Reset.' };
    }

    var data = file.data;
    var chores = checkItems(data.chores, function (c) {
      if (typeof c.recurring !== 'boolean' || !isTextOrNull(c.doneWeek)) return null;
      return { recurring: c.recurring, doneWeek: c.doneWeek };
    });
    if (!chores) return { ok: false, error: 'The chores list in this backup is damaged.' };

    var supplies = checkItems(data.supplies, function (s) {
      if (typeof s.done !== 'boolean') return null;
      return { done: s.done };
    });
    if (!supplies) return { ok: false, error: 'The supplies list in this backup is damaged.' };

    var pets = checkItems(data.pets, function (p) {
      if (!isTextOrNull(p.doneDay)) return null;
      return { doneDay: p.doneDay };
    });
    if (!pets) return { ok: false, error: 'The cat-care list in this backup is damaged.' };

    var history = checkHistory(data.history);
    if (!history) return { ok: false, error: 'The weekly history in this backup is damaged.' };

    return {
      ok: true,
      state: {
        version: STORAGE_VERSION,
        chores: chores,
        supplies: supplies,
        pets: pets,
        history: history
      },
      summary: {
        exportedAt: typeof file.exportedAt === 'string' ? file.exportedAt : null,
        chores: chores.length,
        supplies: supplies.length,
        pets: pets.length,
        weeks: Object.keys(history).length
      }
    };
  }

  global.HouseholdLogic = {
    STORAGE_VERSION: STORAGE_VERSION,
    DEFAULT_CHORES: DEFAULT_CHORES,
    DEFAULT_SUPPLIES: DEFAULT_SUPPLIES,
    DEFAULT_PET_TASKS: DEFAULT_PET_TASKS,
    weekKey: weekKey,
    dayKey: dayKey,
    weekStartDay: weekStartDay,
    createChore: createChore,
    createSupply: createSupply,
    createPetTask: createPetTask,
    createDefaultState: createDefaultState,
    isChoreDone: isChoreDone,
    isPetTaskDone: isPetTaskDone,
    toggleChore: toggleChore,
    togglePetTask: togglePetTask,
    toggleSupply: toggleSupply,
    weeklyProgress: weeklyProgress,
    recordWeek: recordWeek,
    rollover: rollover,
    pastWeeks: pastWeeks,
    parseState: parseState,
    cleanName: cleanName,
    createBackup: createBackup,
    backupFileName: backupFileName,
    validateBackup: validateBackup
  };
})(typeof window !== 'undefined' ? window : globalThis);
