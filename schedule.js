/*
 * schedule.js — the room-by-room cleaning calendar (version 1.2).
 *
 * Big ideas in this file:
 *  - Dates are stored as text like "2026-10-24" and turned into plain day
 *    numbers for maths. Day numbers ignore clocks, so daylight-saving
 *    changes and New Year can't shift a week.
 *  - A cleaning week runs Saturday to Friday and is named by its Saturday.
 *  - Whether a chore is due in a week is *calculated* from its frequency.
 *    Only things you actually do (done, skipped, moved) are stored, as
 *    "records". Looking at another week never saves anything.
 */
(function (global) {
  'use strict';

  var DAY_MS = 86400000;
  var BIWEEKLY_ANCHOR = '2026-10-24'; // a Saturday; every second week from here
  var QUARTER_ANCHOR_MONTH = 10; // October 2026, then January, April, July…

  var ROOMS = [
    { id: 'bathroom', name: 'Bathroom', icon: '🛁' },
    { id: 'kitchen', name: 'Kitchen', icon: '🍳' },
    { id: 'living-room', name: 'Living Room', icon: '🛋️' },
    { id: 'bedroom', name: 'Bedroom', icon: '🛏️' },
    { id: 'laundry', name: 'Laundry', icon: '🧺' },
    { id: 'cat-litter-room', name: 'Cat Litter Room', icon: '🐈' },
    { id: 'whole-house', name: 'Whole House', icon: '🏡' }
  ];

  var FREQUENCIES = {
    weekly: { label: 'Weekly', icon: '↻', order: 1 },
    biweekly: { label: 'Every 2 weeks', icon: '⇄', order: 2 },
    monthly: { label: 'Monthly', icon: '◐', order: 3 },
    quarterly: { label: 'Quarterly', icon: '◆', order: 4 },
    asneeded: { label: 'As needed', icon: '○', order: 5 }
  };

  // The approved starting chore lists, room by room.
  var DEFAULT_TASKS = {
    bathroom: {
      weekly: ['Clean toilet', 'Wipe sink and counter'],
      biweekly: ['Clean mirror', 'Change bathroom trash', 'Wash floor mats'],
      monthly: ['Deep clean shower/tub', 'Wash shower curtains'],
      quarterly: ['Mop bathroom floor'],
      asneeded: ['Clean drawers/cabinets']
    },
    kitchen: {
      weekly: ['Clean kitchen sink', 'Take out kitchen trash', 'Clean food out of fridge', 'Wash kitchen towels'],
      biweekly: ['Wipe countertops', 'Clean stovetop', 'Clean microwave'],
      monthly: ['Wipe cabinet fronts', 'Clean refrigerator interior'],
      quarterly: ['Mop kitchen floor', 'Clean oven'],
      asneeded: ['Organize pantry']
    },
    'living-room': {
      weekly: ['Vacuum living room floor', 'Tidy and put away clutter', 'Wash throw blankets',
        'Organize shoe cubby', 'Sort the mail'],
      monthly: ['Dust furniture and surfaces', 'Wipe TV and electronics', 'Tidy the coat rack'],
      quarterly: ['Vacuum couch and cushions', 'Dust ceiling fan / light fixtures']
    },
    bedroom: {
      weekly: ['Tidy bedroom / put away clutter', 'Make bed / straighten bedding', 'Vacuum bedroom floor'],
      biweekly: ['Strip bedding & wash sheets/comforter', 'Clean bedroom mirror', 'Change bedroom trash'],
      asneeded: ['Dust bedroom furniture', 'Wipe nightstands']
    },
    'cat-litter-room': {
      weekly: ['Scoop litter', 'Vacuum floor']
    },
    'whole-house': {
      monthly: ['Change scent booster plugins']
    }
  };

  // Supplies a chore genuinely needs, used by "Get ready for next week".
  // Only less-frequent chores with a real supply need are listed, so there
  // are no generic questions for everyday chores.
  var DEFAULT_TASK_SUPPLIES = {
    'whole-house-change-scent-booster-plugins': ['Scent plugin refills'],
    'kitchen-clean-oven': ['Oven cleaner'],
    'bathroom-deep-clean-shower-tub': ['Tub & tile cleaner'],
    'bathroom-clean-mirror': ['Glass cleaner'],
    'bedroom-clean-bedroom-mirror': ['Glass cleaner'],
    'bathroom-change-bathroom-trash': ['Small trash bags'],
    'bedroom-change-bedroom-trash': ['Small trash bags'],
    'bathroom-mop-bathroom-floor': ['Floor cleaner'],
    'kitchen-mop-kitchen-floor': ['Floor cleaner']
  };

  // ---------- Dates as day numbers ----------

  function pad2(n) {
    return (n < 10 ? '0' : '') + n;
  }

  function isDateText(text) {
    if (typeof text !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
    return fromDayNumber(toDayNumber(text)) === text; // rejects "2026-02-31"
  }

  // "2026-10-24" -> a whole number of days since 1 January 1970.
  function toDayNumber(text) {
    var p = text.split('-');
    return Math.round(Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2])) / DAY_MS);
  }

  function fromDayNumber(n) {
    var d = new Date(n * DAY_MS);
    return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate());
  }

  // Today's date on this device, as "2026-10-25".
  function todayText(date) {
    var d = date || new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function addDays(text, days) {
    return fromDayNumber(toDayNumber(text) + days);
  }

  function addWeeks(text, weeks) {
    return addDays(text, weeks * 7);
  }

  function dayOfWeek(text) { // 0 = Sunday … 6 = Saturday
    return new Date(toDayNumber(text) * DAY_MS).getUTCDay();
  }

  // The Saturday that starts the cleaning week containing this date.
  function weekStart(text) {
    return addDays(text, -((dayOfWeek(text) + 1) % 7));
  }

  function weekEnd(week) {
    return addDays(week, 6);
  }

  function isSaturday(text) {
    return isDateText(text) && dayOfWeek(text) === 6;
  }

  // A number that works like "%" but never goes negative: mod(-1, 2) = 1.
  function mod(n, m) {
    return ((n % m) + m) % m;
  }

  function weeksBetween(fromWeek, toWeek) {
    return Math.round((toDayNumber(toWeek) - toDayNumber(fromWeek)) / 7);
  }

  function formatDate(text, withYear) {
    var options = { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' };
    if (withYear) options.year = 'numeric';
    return new Date(toDayNumber(text) * DAY_MS).toLocaleDateString(undefined, options);
  }

  function formatShort(text) {
    return new Date(toDayNumber(text) * DAY_MS)
      .toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
  }

  // "Sat, Oct 24 – Fri, Oct 30, 2026"
  function formatWeekRange(week) {
    return formatDate(week, false) + ' – ' + formatDate(weekEnd(week), true);
  }

  // A short range for labels: "Oct 24–30" or "Oct 31–Nov 6".
  function formatRangeShort(week) {
    var end = weekEnd(week);
    var endText = end.slice(5, 7) === week.slice(5, 7) ? String(Number(end.slice(8, 10))) : formatShort(end);
    return formatShort(week) + '–' + endText;
  }

  // ---------- Frequency rules ----------

  // Is a chore with this frequency due in the cleaning week starting `week`?
  function isDueInWeek(task, week) {
    var day = Number(week.slice(8, 10));
    var month = Number(week.slice(5, 7));
    switch (task.frequency) {
      case 'weekly':
        return true;
      case 'biweekly':
        return mod(weeksBetween(task.anchor || BIWEEKLY_ANCHOR, week), 2) === 0;
      case 'monthly':
        return day <= 7; // the week starting on the month's first Saturday
      case 'quarterly':
        return day <= 7 && mod(month - QUARTER_ANCHOR_MONTH, 3) === 0;
      default:
        return false; // "as needed" is never scheduled
    }
  }

  function isScheduled(task) {
    return task.frequency !== 'asneeded';
  }

  // The first week a chore can be due or overdue: never before version 1.2
  // was activated, and never before the chore was added or last re-scheduled.
  function trackingStart(state, task) {
    return task.since > state.activatedWeek ? task.since : state.activatedWeek;
  }

  // ---------- Tasks ----------

  function slug(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function makeId() {
    return 't-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function cleanName(text) {
    return String(text || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  }

  function roomById(id) {
    return ROOMS.filter(function (r) { return r.id === id; })[0] || null;
  }

  // The approved chore lists as task objects. Ids are predictable
  // ("bathroom-clean-toilet") so the same chore is never created twice.
  function createDefaultTasks(week) {
    var tasks = [];
    ROOMS.forEach(function (room) {
      var lists = DEFAULT_TASKS[room.id] || {};
      Object.keys(FREQUENCIES).forEach(function (frequency) {
        (lists[frequency] || []).forEach(function (name) {
          var task = { id: room.id + '-' + slug(name), room: room.id, name: name, frequency: frequency, since: week };
          if (frequency === 'biweekly') task.anchor = BIWEEKLY_ANCHOR;
          if (DEFAULT_TASK_SUPPLIES[task.id]) task.supplies = DEFAULT_TASK_SUPPLIES[task.id].slice();
          tasks.push(task);
        });
      });
    });
    return tasks;
  }

  function findTask(state, id) {
    return state.tasks.filter(function (t) { return t.id === id; })[0] || null;
  }

  // Tidies a list of supply names (or "a, b, c" text): no blanks, no
  // repeats (ignoring capitals), at most 5. Returns [] when there are none.
  function cleanSupplies(list) {
    if (typeof list === 'string') list = list.split(',');
    if (!Array.isArray(list)) return [];
    var seen = {};
    var out = [];
    list.forEach(function (item) {
      var name = String(item || '').replace(/\s+/g, ' ').trim().slice(0, 60);
      var key = name.toLowerCase();
      if (name && !seen[key] && out.length < 5) {
        seen[key] = true;
        out.push(name);
      }
    });
    return out;
  }

  // Sets a chore's supplies. An empty list is kept as [] ("you chose none"),
  // so a default supply link is never added back after you removed it.
  function setSupplies(task, supplies) {
    task.supplies = cleanSupplies(supplies);
  }

  // Older version 1.2 data was saved before default supply links existed.
  // Adds a default link only to an approved chore that has NO supplies field
  // at all; chores you customised (including ones you cleared) are left alone.
  // Returns the number of chores updated.
  function addMissingDefaultSupplies(state) {
    var updated = 0;
    state.tasks.forEach(function (task) {
      if (task.supplies === undefined && DEFAULT_TASK_SUPPLIES[task.id]) {
        task.supplies = DEFAULT_TASK_SUPPLIES[task.id].slice();
        updated++;
      }
    });
    return updated;
  }

  // Adds a chore to a room. Returns the new task, or null if the name is blank.
  // `supplies` (optional) lists household supplies the chore needs.
  function addTask(state, roomId, name, frequency, anchor, today, supplies) {
    var clean = cleanName(name);
    if (!clean || !roomById(roomId) || !FREQUENCIES[frequency]) return null;
    var task = { id: makeId(), room: roomId, name: clean, frequency: frequency, since: weekStart(today) };
    if (frequency === 'biweekly') task.anchor = isSaturday(anchor) ? anchor : BIWEEKLY_ANCHOR;
    if (cleanSupplies(supplies).length) setSupplies(task, supplies);
    state.tasks.push(task);
    return task;
  }

  // Renames a chore or changes how often it repeats. A new schedule only
  // counts from this week on, so it can't create overdue chores in the past.
  // Leave `supplies` undefined to keep the chore's supplies as they are.
  function editTask(state, id, name, frequency, anchor, today, supplies) {
    var task = findTask(state, id);
    var clean = cleanName(name);
    if (!task || !clean || !FREQUENCIES[frequency]) return false;
    var newAnchor = frequency === 'biweekly' ? (isSaturday(anchor) ? anchor : BIWEEKLY_ANCHOR) : undefined;
    var scheduleChanged = task.frequency !== frequency || task.anchor !== newAnchor;
    task.name = clean;
    task.frequency = frequency;
    if (newAnchor) task.anchor = newAnchor; else delete task.anchor;
    if (scheduleChanged) task.since = weekStart(today);
    if (supplies !== undefined) setSupplies(task, supplies);
    return true;
  }

  // Removes a chore. Its completion records stay, so History keeps them.
  function deleteTask(state, id) {
    var before = state.tasks.length;
    state.tasks = state.tasks.filter(function (t) { return t.id !== id; });
    return state.tasks.length < before;
  }

  // ---------- Occurrences: one chore in one scheduled week ----------

  function recordKey(taskId, week) {
    return taskId + '|' + week;
  }

  function getRecord(state, taskId, week) {
    return state.records[recordKey(taskId, week)] || null;
  }

  function ensureRecord(state, task, week) {
    var key = recordKey(task.id, week);
    if (!state.records[key]) {
      state.records[key] = { taskId: task.id, week: week, room: task.room, name: task.name };
    }
    return state.records[key];
  }

  // Deletes a record that no longer says anything (not done, skipped, or moved).
  function tidyRecord(state, record) {
    if (!record.status && !record.movedTo && !record.note && !record.deferred) delete state.records[recordKey(record.taskId, record.week)];
  }

  // A short note on one chore occurrence ("I didn't have trash bags").
  // Saved with that week's record, so it stays in History after completion.
  // An empty note clears it.
  function setNote(state, taskId, week, text) {
    var task = findTask(state, taskId);
    if (!task) return false;
    var note = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 200);
    var record = ensureRecord(state, task, week);
    if (note) record.note = note; else delete record.note;
    tidyRecord(state, record);
    return true;
  }

  // Mark one occurrence done (keeps an existing completion date).
  function setDone(state, taskId, week, today) {
    var task = findTask(state, taskId);
    if (!task) return false;
    var record = ensureRecord(state, task, week);
    if (record.status !== 'done') {
      record.status = 'done';
      record.completedOn = today;
      record.name = task.name;
    }
    return true;
  }

  // Re-open one occurrence (the opposite of setDone). Notes and moves stay.
  function setOpen(state, taskId, week) {
    var record = getRecord(state, taskId, week);
    if (!record) return false;
    delete record.status;
    delete record.completedOn;
    tidyRecord(state, record);
    return true;
  }

  function statusOf(record, effectiveWeek, currentWeek) {
    if (record && record.status) return record.status; // 'done' or 'skipped'
    if (effectiveWeek < currentWeek) return 'overdue';
    if (effectiveWeek === currentWeek) return 'due';
    return 'upcoming';
  }

  function makeOccurrence(task, week, record, currentWeek) {
    var effective = record && record.movedTo ? record.movedTo : week;
    return {
      task: task,
      week: week, // the week it was originally scheduled
      effectiveWeek: effective, // the week it shows up in (after any move)
      record: record,
      status: statusOf(record, effective, currentWeek),
      deferred: !!(record && record.deferred) // "Skip for now": still unfinished
    };
  }

  // All scheduled chores for one room (or every room if roomId is null) that
  // show up in `week`. Reading only — nothing is saved.
  function occurrencesForWeek(state, roomId, week, today) {
    var currentWeek = weekStart(today);
    var list = [];
    state.tasks.forEach(function (task) {
      if (!isScheduled(task) || (roomId && task.room !== roomId)) return;
      if (week >= trackingStart(state, task) && isDueInWeek(task, week)) {
        var record = getRecord(state, task.id, week);
        if (!record || !record.movedTo || record.movedTo === week) {
          list.push(makeOccurrence(task, week, record, currentWeek));
        }
      }
    });
    // Chores moved into this week from another week.
    Object.keys(state.records).forEach(function (key) {
      var record = state.records[key];
      if (record.movedTo !== week || record.week === week) return;
      var task = findTask(state, record.taskId);
      if (task && (!roomId || task.room === roomId)) list.push(makeOccurrence(task, record.week, record, currentWeek));
    });
    return sortOccurrences(list);
  }

  function sortOccurrences(list) {
    return list.sort(function (a, b) {
      return FREQUENCIES[a.task.frequency].order - FREQUENCIES[b.task.frequency].order ||
        (a.week < b.week ? -1 : a.week > b.week ? 1 : 0);
    });
  }

  // Every missed chore from earlier weeks that still needs doing. Each missed
  // week appears exactly once, with its original due week.
  function overdueOccurrences(state, roomId, today) {
    var currentWeek = weekStart(today);
    var list = [];
    state.tasks.forEach(function (task) {
      if (!isScheduled(task) || (roomId && task.room !== roomId)) return;
      for (var week = trackingStart(state, task); week < currentWeek; week = addWeeks(week, 1)) {
        if (!isDueInWeek(task, week)) continue;
        var record = getRecord(state, task.id, week);
        var occ = makeOccurrence(task, week, record, currentWeek);
        if (occ.status === 'overdue') list.push(occ);
      }
    });
    // Chores moved to a week that has now passed (or moved from outside the
    // normal schedule) are overdue too.
    Object.keys(state.records).forEach(function (key) {
      var record = state.records[key];
      var task = findTask(state, record.taskId);
      if (!task || !record.movedTo || record.status || (roomId && task.room !== roomId)) return;
      var alreadyListed = isDueInWeek(task, record.week) && record.week >= trackingStart(state, task);
      if (record.movedTo < currentWeek && !alreadyListed) list.push(makeOccurrence(task, record.week, record, currentWeek));
    });
    return list.sort(function (a, b) { return a.week < b.week ? -1 : a.week > b.week ? 1 : 0; });
  }

  // Tick or untick a chore for the week it was scheduled. `today` is saved
  // as the real completion date, even when the chore is late.
  function toggleDone(state, taskId, week, today) {
    var task = findTask(state, taskId);
    if (!task) return false;
    var record = ensureRecord(state, task, week);
    if (record.status === 'done') {
      delete record.status;
      delete record.completedOn;
    } else {
      record.status = 'done';
      record.completedOn = today;
      record.name = task.name;
    }
    tidyRecord(state, record);
    return true;
  }

  // Mark a chore as deliberately skipped for that week (or undo the skip).
  function toggleSkip(state, taskId, week) {
    var task = findTask(state, taskId);
    if (!task) return false;
    var record = ensureRecord(state, task, week);
    if (record.status === 'skipped') {
      delete record.status;
    } else {
      record.status = 'skipped';
      delete record.completedOn;
    }
    tidyRecord(state, record);
    return true;
  }

  // "Skip for now" (version 1.3): a note to yourself that you're not doing
  // this occurrence right now. It does NOT finish or dismiss it: it stays
  // unfinished, so it's due this week and overdue once its week ends.
  // Turning it off ("Undo Skip") also undoes a move made after skipping.
  // Older "skipped" records (status 'skipped', which meant "dismissed") are
  // never changed by this; see toggleSkip.
  function setDeferred(state, taskId, week, on) {
    var task = findTask(state, taskId);
    if (!task) return false;
    var record = ensureRecord(state, task, week);
    if (on) {
      record.deferred = true;
    } else {
      delete record.deferred;
      delete record.movedTo;
    }
    tidyRecord(state, record);
    return true;
  }

  // Occurrences scheduled in `week` that were moved to a different week.
  // Shown in their original week only to explain where they went.
  function movedOut(state, roomId, week, today) {
    var currentWeek = weekStart(today);
    var list = [];
    Object.keys(state.records).forEach(function (key) {
      var r = state.records[key];
      if (r.week !== week || !r.movedTo || r.movedTo === week) return;
      var task = findTask(state, r.taskId);
      if (task && (!roomId || task.room === roomId)) list.push(makeOccurrence(task, r.week, r, currentWeek));
    });
    return list;
  }

  // Move one chore occurrence to another week (this week or later).
  function moveOccurrence(state, taskId, week, toWeek, today) {
    var task = findTask(state, taskId);
    if (!task || !isSaturday(toWeek) || toWeek < weekStart(today)) return false;
    var record = ensureRecord(state, task, week);
    if (toWeek === week) delete record.movedTo; else record.movedTo = toWeek;
    tidyRecord(state, record);
    return true;
  }

  // For a FUTURE week in the room checklist: chores that are still open from
  // before it (overdue now, or due this week and not done yet). Their status
  // is NOT changed: this is only a preview of what will carry over.
  function openBefore(state, roomId, viewWeek, today) {
    var current = weekStart(today);
    if (viewWeek <= current) return [];
    var stillOpen = overdueOccurrences(state, roomId, today).concat(
      occurrencesForWeek(state, roomId, current, today).filter(function (o) { return o.status === 'due'; })
    );
    return stillOpen.filter(function (o) { return o.effectiveWeek < viewWeek; });
  }

  function skipAllOverdue(state, roomId, today) {
    var list = overdueOccurrences(state, roomId, today);
    list.forEach(function (occ) {
      var record = ensureRecord(state, occ.task, occ.week);
      record.status = 'skipped';
    });
    return list.length;
  }

  // ---------- "As needed" chores ----------

  function asNeededTasks(state, roomId) {
    return state.tasks.filter(function (t) { return t.frequency === 'asneeded' && t.room === roomId; });
  }

  function markAsNeededDone(state, taskId, today) {
    var task = findTask(state, taskId);
    if (!task || task.frequency !== 'asneeded') return false;
    state.asNeeded.push({ id: makeId(), taskId: task.id, room: task.room, name: task.name, completedOn: today });
    return true;
  }

  function lastDone(state, taskId) {
    var dates = state.asNeeded
      .filter(function (e) { return e.taskId === taskId; })
      .map(function (e) { return e.completedOn; })
      .sort();
    return dates.length ? dates[dates.length - 1] : null;
  }

  // Removes today's "done" for an as-needed chore (for mistakes).
  function undoAsNeededToday(state, taskId, today) {
    for (var i = state.asNeeded.length - 1; i >= 0; i--) {
      if (state.asNeeded[i].taskId === taskId && state.asNeeded[i].completedOn === today) {
        state.asNeeded.splice(i, 1);
        return true;
      }
    }
    return false;
  }

  // ---------- Progress, overview, upcoming ----------

  function progressOf(occurrences) {
    var counted = occurrences.filter(function (o) { return o.status !== 'skipped'; });
    var done = counted.filter(function (o) { return o.status === 'done'; }).length;
    var total = counted.length;
    return { done: done, total: total, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
  }

  // The next week (this week or later, or from `fromWeek`) a scheduled chore
  // is due and not done.
  function nextDueWeek(state, task, today, fromWeek) {
    if (!isScheduled(task)) return null;
    var week = fromWeek || weekStart(today);
    if (week < trackingStart(state, task)) week = trackingStart(state, task);
    for (var i = 0; i < 60; i++, week = addWeeks(week, 1)) {
      if (!isDueInWeek(task, week)) continue;
      var record = getRecord(state, task.id, week);
      if (!record || (!record.status && !record.movedTo)) return week;
    }
    return null;
  }

  // Less-frequent chores and when they're next due after this week, soonest
  // first. (Chores due this week are shown in the rooms and Reminders.)
  function upcoming(state, today, limitWeeks) {
    var current = weekStart(today);
    var last = addWeeks(current, limitWeeks || 14);
    var list = [];
    state.tasks.forEach(function (task) {
      if (task.frequency === 'weekly' || !isScheduled(task)) return;
      var week = nextDueWeek(state, task, today, addWeeks(current, 1));
      if (week && week <= last) list.push({ task: task, week: week, weeksAway: weeksBetween(current, week) });
    });
    // Moved chores waiting in a future week.
    Object.keys(state.records).forEach(function (key) {
      var r = state.records[key];
      var task = findTask(state, r.taskId);
      if (task && r.movedTo && !r.status && r.movedTo > current && r.movedTo <= last) {
        list.push({ task: task, week: r.movedTo, weeksAway: weeksBetween(current, r.movedTo), moved: true });
      }
    });
    return list.sort(function (a, b) {
      return a.week < b.week ? -1 : a.week > b.week ? 1 : FREQUENCIES[a.task.frequency].order - FREQUENCIES[b.task.frequency].order;
    });
  }

  function isLessFrequent(task) {
    return task.frequency !== 'weekly' && isScheduled(task);
  }

  function overview(state, week, today) {
    var occ = occurrencesForWeek(state, null, week, today);
    var progress = progressOf(occ);
    var current = weekStart(today);
    // Less-frequent chores due in the week after the one shown (not done or skipped).
    var nextWeek = occurrencesForWeek(state, null, addWeeks(week, 1), today).filter(function (o) {
      return isLessFrequent(o.task) && o.status !== 'done' && o.status !== 'skipped';
    }).length;
    return {
      week: week,
      isCurrent: week === current,
      isBeforeActivation: week < state.activatedWeek,
      due: progress.total,
      completed: progress.done,
      overdue: overdueOccurrences(state, null, today).length,
      nextWeek: nextWeek
    };
  }

  // ---------- Heads up ----------

  // Up to three summary groups for the week being viewed, most important
  // first. Every chore listed belongs to the week the group names:
  //   'overdue'  current week: missed chores from earlier weeks (any frequency)
  //              past week:    chores from THAT week still not done
  //   'due'      less-frequent chores due in the week viewed, not yet done
  //   'soon'     monthly/quarterly chores due the week after the one viewed
  // Ordinary weekly chores only appear when overdue. Reading only.
  function headsUp(state, week, today) {
    var current = weekStart(today);
    var relation = week === current ? 'current' : week < current ? 'past' : 'future';
    var result = { week: week, relation: relation, beforeActivation: week < state.activatedWeek, groups: [] };
    if (result.beforeActivation) return result;

    function item(o) {
      return { task: o.task, week: o.week, effectiveWeek: o.effectiveWeek, note: o.record && o.record.note ? o.record.note : '' };
    }

    var inWeek = occurrencesForWeek(state, null, week, today);
    var overdue = relation === 'current'
      ? overdueOccurrences(state, null, today)
      : relation === 'past' ? inWeek.filter(function (o) { return o.status === 'overdue'; }) : [];
    if (overdue.length) {
      result.groups.push({ kind: 'overdue', items: overdue.map(item) });
    }

    if (relation !== 'past') {
      var due = inWeek.filter(function (o) {
        return isLessFrequent(o.task) && (o.status === 'due' || o.status === 'upcoming');
      });
      if (due.length) result.groups.push({ kind: 'due', items: due.map(item) });

      var following = addWeeks(week, 1);
      var soon = occurrencesForWeek(state, null, following, today).filter(function (o) {
        return (o.task.frequency === 'monthly' || o.task.frequency === 'quarterly') && o.status === 'upcoming';
      });
      if (soon.length) result.groups.push({ kind: 'soon', week: following, items: soon.map(item) });
    }
    result.groups = result.groups.slice(0, 3);
    return result;
  }

  // A read-only summary of one past week for the History tab.
  function weekHistory(state, week, today) {
    var occ = occurrencesForWeek(state, null, week, today);
    // Records whose chore was deleted or re-scheduled still count as history.
    Object.keys(state.records).forEach(function (key) {
      var r = state.records[key];
      var shown = occ.some(function (o) { return o.record === r; });
      if (!shown && r.week === week && r.status && !r.movedTo) {
        occ.push({ task: { id: r.taskId, name: r.name, room: r.room, frequency: 'weekly' },
          week: r.week, effectiveWeek: r.week, record: r, status: r.status, archivedTask: true });
      }
    });
    var asNeeded = state.asNeeded.filter(function (e) { return weekStart(e.completedOn) === week; });
    return {
      week: week,
      done: occ.filter(function (o) { return o.status === 'done'; }),
      skipped: occ.filter(function (o) { return o.status === 'skipped'; }),
      missed: occ.filter(function (o) { return o.status === 'overdue'; }),
      asNeeded: asNeeded
    };
  }

  global.HouseholdSchedule = {
    BIWEEKLY_ANCHOR: BIWEEKLY_ANCHOR,
    ROOMS: ROOMS,
    FREQUENCIES: FREQUENCIES,
    DEFAULT_TASKS: DEFAULT_TASKS,
    isDateText: isDateText,
    isSaturday: isSaturday,
    toDayNumber: toDayNumber,
    fromDayNumber: fromDayNumber,
    todayText: todayText,
    addDays: addDays,
    addWeeks: addWeeks,
    weekStart: weekStart,
    weekEnd: weekEnd,
    weeksBetween: weeksBetween,
    formatDate: formatDate,
    formatShort: formatShort,
    formatWeekRange: formatWeekRange,
    formatRangeShort: formatRangeShort,
    setNote: setNote,
    setDeferred: setDeferred,
    movedOut: movedOut,
    setDone: setDone,
    setOpen: setOpen,
    openBefore: openBefore,
    isDueInWeek: isDueInWeek,
    isScheduled: isScheduled,
    cleanName: cleanName,
    roomById: roomById,
    createDefaultTasks: createDefaultTasks,
    findTask: findTask,
    addTask: addTask,
    editTask: editTask,
    deleteTask: deleteTask,
    recordKey: recordKey,
    getRecord: getRecord,
    occurrencesForWeek: occurrencesForWeek,
    overdueOccurrences: overdueOccurrences,
    toggleDone: toggleDone,
    toggleSkip: toggleSkip,
    moveOccurrence: moveOccurrence,
    skipAllOverdue: skipAllOverdue,
    asNeededTasks: asNeededTasks,
    markAsNeededDone: markAsNeededDone,
    lastDone: lastDone,
    undoAsNeededToday: undoAsNeededToday,
    progressOf: progressOf,
    nextDueWeek: nextDueWeek,
    upcoming: upcoming,
    overview: overview,
    headsUp: headsUp,
    cleanSupplies: cleanSupplies,
    addMissingDefaultSupplies: addMissingDefaultSupplies,
    DEFAULT_TASK_SUPPLIES: DEFAULT_TASK_SUPPLIES,
    weekHistory: weekHistory
  };
})(typeof window !== 'undefined' ? window : globalThis);
