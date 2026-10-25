/*
 * prep.js — "Get ready for next week" (version 1.2).
 *
 * Looks only at NEXT week's Saturday–Friday cleaning week, and only at chores
 * that list supplies they need (like "Change scent booster plugins" needing
 * "Scent plugin refills"). For each one it asks: are you stocked?
 *
 *  - Answers are saved in state.prep, one per chore occurrence
 *    ("taskId|scheduled week"), so a question doesn't come back after a refresh.
 *  - Being on the Supplies list never counts as "in stock": the question is
 *    still asked. (On the Supplies list, ticked = stocked, unticked = needed.)
 *  - "Add to supplies" adds missing items once, and marks items that already
 *    exist as needed instead of adding them again. Undo puts things back.
 */
(function (global) {
  'use strict';

  var L = global.HouseholdLogic;
  var S = global.HouseholdSchedule;

  // The Saturday that starts next week's cleaning week.
  function nextWeek(today) {
    return S.addWeeks(S.weekStart(today), 1);
  }

  function normal(name) {
    return String(name || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  // Finds a supply by name, ignoring capitals and extra spaces.
  function findSupply(state, name) {
    var key = normal(name);
    return state.supplies.filter(function (s) { return normal(s.name) === key; })[0] || null;
  }

  // One prompt per chore occurrence due next week that lists supplies.
  // Each supply shows whether it's on the Supplies list and how it's ticked.
  function prompts(state, today) {
    var week = nextWeek(today);
    return S.occurrencesForWeek(state, null, week, today)
      .filter(function (o) { return o.status === 'upcoming' && o.task.supplies && o.task.supplies.length; })
      .map(function (o) {
        var key = S.recordKey(o.task.id, o.week);
        return {
          key: key,
          task: o.task,
          week: o.week,
          effectiveWeek: o.effectiveWeek,
          supplies: o.task.supplies.map(function (name) {
            var supply = findSupply(state, name);
            return { name: name, supply: supply, status: !supply ? 'missing' : supply.done ? 'ticked' : 'needed' };
          }),
          answer: state.prep[key] || null
        };
      });
  }

  // Groups prompts that ask about exactly the same supplies, so each question
  // is asked once ("Glass cleaner" for two mirrors). Answers are still saved
  // per chore occurrence. `pending` lists the prompts not yet answered.
  function groupPrompts(list) {
    var groups = [];
    var byKey = {};
    list.forEach(function (p) {
      var key = p.task.supplies.map(normal).sort().join('|');
      if (!byKey[key]) {
        byKey[key] = { key: key, supplies: p.supplies, prompts: [] };
        groups.push(byKey[key]);
      }
      byKey[key].prompts.push(p);
    });
    groups.forEach(function (g) {
      g.pending = g.prompts.filter(function (p) { return !p.answer; });
    });
    return groups;
  }

  // What the "Add to supplies" button would do: 'add', 'mark', or 'both'.
  function addAction(prompt) {
    var missing = prompt.supplies.filter(function (s) { return !s.supply; }).length;
    if (missing === prompt.supplies.length) return 'add';
    return missing === 0 ? 'mark' : 'both';
  }

  function answerStocked(state, prompt, today) {
    if (state.prep[prompt.key]) return false;
    state.prep[prompt.key] = { answer: 'stocked', answeredOn: today, added: [], marked: [] };
    return true;
  }

  // Adds missing supplies (once) and marks existing ones as needed (unticked).
  function addToSupplies(state, prompt, today) {
    if (state.prep[prompt.key]) return false;
    var added = [];
    var marked = [];
    prompt.task.supplies.forEach(function (name) {
      var existing = findSupply(state, name);
      if (existing) {
        if (!marked.some(function (m) { return m.id === existing.id; })) {
          marked.push({ id: existing.id, wasDone: existing.done });
          existing.done = false;
        }
      } else {
        var item = L.createSupply(name);
        state.supplies.push(item);
        added.push(item.id);
      }
    });
    state.prep[prompt.key] = { answer: 'added', answeredOn: today, added: added, marked: marked };
    return true;
  }

  // Undo an answer so the question shows again. Supplies it added are removed
  // (if still there, and no other answer relies on them) and supplies it
  // marked as needed get their old tick back.
  function undoAnswer(state, key) {
    var record = state.prep[key];
    if (!record) return false;
    var usedElsewhere = {};
    Object.keys(state.prep).forEach(function (other) {
      if (other === key) return;
      state.prep[other].added.forEach(function (id) { usedElsewhere[id] = true; });
      state.prep[other].marked.forEach(function (m) { usedElsewhere[m.id] = true; });
    });
    state.supplies = state.supplies.filter(function (s) {
      return record.added.indexOf(s.id) === -1 || usedElsewhere[s.id];
    });
    record.marked.forEach(function (m) {
      var supply = state.supplies.filter(function (s) { return s.id === m.id; })[0];
      if (supply) supply.done = m.wasDone;
    });
    delete state.prep[key];
    return true;
  }

  global.HouseholdPrep = {
    nextWeek: nextWeek,
    findSupply: findSupply,
    prompts: prompts,
    groupPrompts: groupPrompts,
    addAction: addAction,
    answerStocked: answerStocked,
    addToSupplies: addToSupplies,
    undoAnswer: undoAnswer
  };
})(typeof window !== 'undefined' ? window : globalThis);
