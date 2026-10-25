/*
 * storage.js — saving, loading, upgrading, and backing up (version 1.2).
 *
 * Safety rules this file follows:
 *  - Version 1.2 saves under a NEW name, "householdReset.v2".
 *  - It only ever READS the version 1.1 data ("householdReset.v1") and never
 *    changes or deletes it. If anything goes wrong, the old data is still there.
 *  - The upgrade ("migration") builds the whole new data object in memory
 *    first and saves it in one step, so it can't half-finish.
 *  - Once "householdReset.v2" exists, it's used as-is and the upgrade never
 *    runs again, so refreshing can't duplicate anything.
 */
(function (global) {
  'use strict';

  var L = global.HouseholdLogic;
  var S = global.HouseholdSchedule;
  var W = global.HouseholdLaundry;

  var KEY_V1 = 'householdReset.v1';
  var KEY_V2 = 'householdReset.v2';
  var DATA_VERSION = 2;
  var BACKUP_VERSION = 2;
  var MAX_BACKUP_CHARACTERS = 5000000; // about 5 MB

  // ---------- Building version 2 data ----------

  // A brand-new version 2 state. `v1Data` is checked version 1.1 data (or null).
  function createState(today, v1Data) {
    var week = S.weekStart(today);
    var starter = v1Data || L.createDefaultState(); // gives default supplies and cat tasks
    return {
      version: DATA_VERSION,
      activatedOn: today,
      activatedWeek: week,
      tasks: S.createDefaultTasks(week),
      records: {},
      asNeeded: [],
      laundry: W.createLaundry(),
      supplies: starter.supplies,
      pets: starter.pets,
      legacy: v1Data ? { archivedOn: today, chores: v1Data.chores, history: v1Data.history } : null
    };
  }

  // Checks version 1.1 data with version 1.1's own backup checker.
  // Returns a clean copy, or null if it's damaged.
  function checkV1Data(data) {
    var text = JSON.stringify({ app: 'household-reset', backupVersion: 1, data: data });
    var result = L.validateBackup(text);
    return result.ok ? result.state : null;
  }

  // Upgrades version 1.1 data to version 1.2:
  //  - Supplies and Cats are kept exactly.
  //  - The old chore list and weekly history move into a read-only archive.
  //  - The new room schedule starts fresh, with no invented completions.
  function migrateFromV1(v1Data, today) {
    var clean = checkV1Data(v1Data);
    if (!clean) {
      var state = createState(today, null);
      state.legacy = {
        archivedOn: today,
        chores: [],
        history: {},
        note: 'Your version 1.1 data could not be read, so it was not copied. It is still stored, untouched, in this browser.'
      };
      return { state: state, problem: true };
    }
    return { state: createState(today, clean), problem: false };
  }

  // ---------- Loading and saving ----------

  function read(storage, key) {
    try {
      return { text: storage.getItem(key) };
    } catch (err) {
      return { text: null, error: true };
    }
  }

  function parseJSON(text) {
    try {
      return JSON.parse(text);
    } catch (err) {
      return undefined;
    }
  }

  // Works out which data to use when the app opens. It saves nothing itself,
  // except a safety copy of damaged version 1.2 data before replacing it.
  // Returns { state, source, canSave, problem, damagedCopy }.
  //   source: 'saved' (normal), 'migrated' (upgraded from 1.1), 'new' (first visit)
  function loadState(storage, today) {
    var v2 = read(storage, KEY_V2);
    if (v2.error) return { state: createState(today, null), source: 'new', canSave: false };

    var damagedCopy = false;
    if (v2.text !== null) {
      var checked = validateState(parseJSON(v2.text));
      if (checked.ok) return { state: checked.state, source: 'saved', canSave: true };
      // Damaged version 1.2 data: keep a copy before doing anything else.
      try {
        storage.setItem(KEY_V2 + '.damaged', v2.text);
        damagedCopy = true;
      } catch (err) {
        return { state: createState(today, null), source: 'new', canSave: false };
      }
    }

    var v1 = read(storage, KEY_V1);
    if (v1.text === null) {
      return { state: createState(today, null), source: 'new', canSave: true, damagedCopy: damagedCopy };
    }
    var migration = migrateFromV1(parseJSON(v1.text), today);
    return {
      state: migration.state,
      source: 'migrated',
      canSave: true,
      problem: migration.problem,
      damagedCopy: damagedCopy
    };
  }

  // Saves version 1.2 data in one step. Never touches version 1.1 data.
  function saveState(storage, state) {
    try {
      storage.setItem(KEY_V2, JSON.stringify(state));
      return true;
    } catch (err) {
      return false;
    }
  }

  // ---------- Checking version 2 data ----------

  function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function isCount(value) {
    return typeof value === 'number' && value >= 0 && Math.floor(value) === value;
  }

  function isId(value) {
    return typeof value === 'string' && value !== '' && value.length <= 120;
  }

  function isDateOrNull(value) {
    return value === null || S.isDateText(value);
  }

  // Runs `check` on every item. Returns the list of copies, or null if any fail.
  function checkList(list, check) {
    if (!Array.isArray(list)) return null;
    var copies = [];
    for (var i = 0; i < list.length; i++) {
      var copy = isPlainObject(list[i]) ? check(list[i]) : null;
      if (!copy) return null;
      copies.push(copy);
    }
    return copies;
  }

  function allUnique(items) {
    var seen = {};
    return items.every(function (item) {
      if (seen[item.id]) return false;
      seen[item.id] = true;
      return true;
    });
  }

  function checkTask(t) {
    var name = S.cleanName(t.name);
    if (!isId(t.id) || !S.roomById(t.room) || !name || !S.FREQUENCIES[t.frequency] || !S.isSaturday(t.since)) return null;
    var copy = { id: t.id, room: t.room, name: name, frequency: t.frequency, since: t.since };
    if (t.frequency === 'biweekly') {
      if (!S.isSaturday(t.anchor)) return null;
      copy.anchor = t.anchor;
    }
    return copy;
  }

  function checkRecords(records) {
    if (!isPlainObject(records)) return null;
    var copy = {};
    var keys = Object.keys(records);
    for (var i = 0; i < keys.length; i++) {
      var r = records[keys[i]];
      if (!isPlainObject(r) || !isId(r.taskId) || !S.isSaturday(r.week)) return null;
      if (keys[i] !== S.recordKey(r.taskId, r.week) || !S.roomById(r.room) || !S.cleanName(r.name)) return null;
      if (r.status !== undefined && r.status !== 'done' && r.status !== 'skipped') return null;
      if (r.status === 'done' && !S.isDateText(r.completedOn)) return null;
      if (r.movedTo !== undefined && !S.isSaturday(r.movedTo)) return null;
      if (!r.status && !r.movedTo) return null;
      var c = { taskId: r.taskId, week: r.week, room: r.room, name: S.cleanName(r.name) };
      if (r.status) c.status = r.status;
      if (r.status === 'done') c.completedOn = r.completedOn;
      if (r.movedTo) c.movedTo = r.movedTo;
      copy[keys[i]] = c;
    }
    return copy;
  }

  function checkAsNeeded(e) {
    if (!isId(e.id) || !isId(e.taskId) || !S.roomById(e.room) || !S.cleanName(e.name) || !S.isDateText(e.completedOn)) return null;
    return { id: e.id, taskId: e.taskId, room: e.room, name: S.cleanName(e.name), completedOn: e.completedOn };
  }

  function makeLoadChecker(categoryIds) {
    return function (l) {
      if (!isId(l.id) || categoryIds.indexOf(l.categoryId) === -1 || typeof l.name !== 'string' || !l.name.trim()) return null;
      if (W.STAGES.indexOf(l.stage) === -1 || !isCount(l.dryCycles) || !S.isDateText(l.addedOn)) return null;
      if (!isDateOrNull(l.finishedOn) || typeof l.putAway !== 'boolean' || !isDateOrNull(l.putAwayOn)) return null;
      if (l.stage === 'finished' && !l.finishedOn) return null;
      if (l.putAway && l.stage !== 'finished') return null;
      return {
        id: l.id, categoryId: l.categoryId, name: l.name.trim().slice(0, 60), stage: l.stage,
        dryCycles: l.dryCycles, addedOn: l.addedOn, finishedOn: l.finishedOn,
        putAway: l.putAway, putAwayOn: l.putAwayOn
      };
    };
  }

  function checkLaundry(laundry) {
    if (!isPlainObject(laundry)) return null;
    var categories = checkList(laundry.categories, function (c) {
      return isId(c.id) && typeof c.name === 'string' && c.name.trim() ? { id: c.id, name: c.name.trim() } : null;
    });
    if (!categories || !categories.length || !allUnique(categories)) return null;
    var checkLoad = makeLoadChecker(categories.map(function (c) { return c.id; }));
    var loads = checkList(laundry.loads, checkLoad);
    var archive = checkList(laundry.archive, checkLoad);
    if (!loads || !archive || !allUnique(loads.concat(archive))) return null;
    // One washer and one dryer: never more than one load in each.
    var inWasher = loads.filter(function (l) { return l.stage === 'washer'; }).length;
    var inDryer = loads.filter(function (l) { return l.stage === 'dryer'; }).length;
    if (inWasher > 1 || inDryer > 1) return null;
    if (archive.some(function (l) { return l.stage !== 'finished'; })) return null;
    return { categories: categories, loads: loads, archive: archive };
  }

  function checkLegacy(legacy) {
    if (legacy === null || legacy === undefined) return null;
    if (!isPlainObject(legacy) || !S.isDateText(legacy.archivedOn)) return false;
    var old = checkV1Data({ chores: legacy.chores, supplies: [], pets: [], history: legacy.history });
    if (!old) return false;
    var copy = { archivedOn: legacy.archivedOn, chores: old.chores, history: old.history };
    if (typeof legacy.note === 'string') copy.note = legacy.note.slice(0, 300);
    return copy;
  }

  // Checks every part of version 1.2 data and returns a clean copy.
  // Returns { ok: true, state } or { ok: false, error }.
  function validateState(data) {
    function fail(part) {
      return { ok: false, error: 'The ' + part + ' in this data ' + (part.slice(-1) === 's' ? 'are' : 'is') + ' damaged.' };
    }
    if (!isPlainObject(data) || data.version !== DATA_VERSION) return { ok: false, error: 'This is not version 1.2 data.' };
    if (!S.isDateText(data.activatedOn) || !S.isSaturday(data.activatedWeek)) return fail('start date');

    var tasks = checkList(data.tasks, checkTask);
    if (!tasks || !allUnique(tasks)) return fail('room chores');
    var records = checkRecords(data.records);
    if (!records) return fail('completion records');
    var asNeeded = checkList(data.asNeeded, checkAsNeeded);
    if (!asNeeded) return fail('as-needed records');
    var laundry = checkLaundry(data.laundry);
    if (!laundry) return fail('laundry loads');
    var lists = checkV1Data({ chores: [], supplies: data.supplies, pets: data.pets, history: {} });
    if (!lists) return fail('supplies or cat-care lists');
    var legacy = checkLegacy(data.legacy);
    if (legacy === false) return fail('version 1.1 archive');

    return {
      ok: true,
      state: {
        version: DATA_VERSION,
        activatedOn: data.activatedOn,
        activatedWeek: data.activatedWeek,
        tasks: tasks,
        records: records,
        asNeeded: asNeeded,
        laundry: laundry,
        supplies: lists.supplies,
        pets: lists.pets,
        legacy: legacy
      }
    };
  }

  // ---------- Backups ----------

  function createBackup(state, now) {
    return {
      app: 'household-reset',
      backupVersion: BACKUP_VERSION,
      exportedAt: now.toISOString(),
      data: state
    };
  }

  function summarize(state, kind, exportedAt) {
    var done = Object.keys(state.records).filter(function (k) { return state.records[k].status === 'done'; }).length;
    return {
      kind: kind, // 'v1' or 'v2'
      exportedAt: typeof exportedAt === 'string' ? exportedAt : null,
      tasks: state.tasks.length,
      completions: done + state.asNeeded.length,
      loads: state.laundry.loads.length + state.laundry.archive.length,
      supplies: state.supplies.length,
      pets: state.pets.length,
      legacyWeeks: state.legacy ? Object.keys(state.legacy.history).length : 0
    };
  }

  // Checks a backup file's text. Accepts version 1.2 backups, and version 1.1
  // backups (which are upgraded the same way as saved 1.1 data).
  // Returns { ok: true, state, summary } or { ok: false, error }. Saves nothing.
  function validateBackup(text, today) {
    var notBackup = "This file isn't a Household Reset backup.";
    if (typeof text !== 'string' || text.trim() === '') return { ok: false, error: 'This file is empty.' };
    if (text.length > MAX_BACKUP_CHARACTERS) return { ok: false, error: 'This file is too large to be a Household Reset backup.' };
    var file = parseJSON(text);
    if (file === undefined) return { ok: false, error: notBackup + ' It could not be read as JSON.' };
    if (!isPlainObject(file) || file.app !== 'household-reset' || !isPlainObject(file.data)) {
      return { ok: false, error: notBackup };
    }

    if (file.backupVersion === 1) {
      var old = L.validateBackup(text); // version 1.1's own checks
      if (!old.ok) return old;
      var upgraded = createState(today, old.state);
      return { ok: true, state: upgraded, summary: summarize(upgraded, 'v1', file.exportedAt) };
    }
    if (file.backupVersion === BACKUP_VERSION) {
      var checked = validateState(file.data);
      if (!checked.ok) return { ok: false, error: checked.error.replace('this data', 'this backup') };
      return { ok: true, state: checked.state, summary: summarize(checked.state, 'v2', file.exportedAt) };
    }
    if (typeof file.backupVersion === 'number' && file.backupVersion > BACKUP_VERSION) {
      return { ok: false, error: 'This backup was made by a newer version of Household Reset.' };
    }
    return { ok: false, error: notBackup };
  }

  global.HouseholdStorage = {
    KEY_V1: KEY_V1,
    KEY_V2: KEY_V2,
    DATA_VERSION: DATA_VERSION,
    BACKUP_VERSION: BACKUP_VERSION,
    createState: createState,
    migrateFromV1: migrateFromV1,
    loadState: loadState,
    saveState: saveState,
    validateState: validateState,
    createBackup: createBackup,
    validateBackup: validateBackup
  };
})(typeof window !== 'undefined' ? window : globalThis);
