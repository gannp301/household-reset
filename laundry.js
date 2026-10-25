/*
 * laundry.js — the laundry load tracker (version 1.2).
 *
 * Each load moves through four stages:
 *   waiting -> washer -> dryer -> finished
 * There is one washer and one dryer, so each can hold only one load.
 * "Put away" is tracked separately and never changes a load's stage.
 */
(function (global) {
  'use strict';

  var STAGES = ['waiting', 'washer', 'dryer', 'finished'];

  var STAGE_LABELS = {
    waiting: 'Waiting to wash',
    washer: 'In washer',
    dryer: 'In dryer',
    finished: 'Finished'
  };

  var DEFAULT_CATEGORIES = [
    { id: 'regular', name: 'Regular clothes' },
    { id: 'bedding', name: 'Bedding' },
    { id: 'towels', name: 'Towels & throw blankets' }
  ];

  function makeId() {
    return 'l-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function cleanName(text) {
    return String(text || '').replace(/\s+/g, ' ').trim().slice(0, 60);
  }

  function createLaundry() {
    return {
      categories: DEFAULT_CATEGORIES.map(function (c) { return { id: c.id, name: c.name }; }),
      loads: [],
      archive: [] // finished, put-away loads you've cleared from the board
    };
  }

  function findLoad(laundry, id) {
    return laundry.loads.filter(function (l) { return l.id === id; })[0] || null;
  }

  function categoryName(laundry, categoryId) {
    var cat = laundry.categories.filter(function (c) { return c.id === categoryId; })[0];
    return cat ? cat.name : 'Laundry';
  }

  // Which load is in the washer or dryer right now (or null if it's free).
  function occupant(laundry, machine) {
    return laundry.loads.filter(function (l) { return l.stage === machine; })[0] || null;
  }

  // Adds a load to a category. Names default to "Bedding 2", "Bedding 3"…
  function addLoad(laundry, categoryId, name, today) {
    var exists = laundry.categories.some(function (c) { return c.id === categoryId; });
    if (!exists) return null;
    var sameCategory = laundry.loads.filter(function (l) { return l.categoryId === categoryId; }).length;
    var load = {
      id: makeId(),
      categoryId: categoryId,
      name: cleanName(name) || categoryName(laundry, categoryId) + ' ' + (sameCategory + 1),
      stage: 'waiting',
      dryCycles: 0,
      addedOn: today,
      finishedOn: null,
      putAway: false,
      putAwayOn: null
    };
    laundry.loads.push(load);
    return load;
  }

  // Checks whether a move is allowed. Returns { ok: true } or { ok: false, reason }.
  //   'wash'     waiting -> washer        (washer must be free)
  //   'dry'      washer  -> dryer         (dryer must be free)
  //   'finish'   dryer   -> finished      (taken out of the dryer)
  //   'dryAgain' dryer stays in dryer for another cycle, or
  //              finished -> dryer         (dryer must be free)
  //   'back'     one stage backwards, to fix a mistake
  function canMove(laundry, load, action) {
    var washer = occupant(laundry, 'washer');
    var dryer = occupant(laundry, 'dryer');
    var washerBusy = washer && washer !== load;
    var dryerBusy = dryer && dryer !== load;
    switch (action) {
      case 'wash':
        if (load.stage !== 'waiting') return { ok: false, reason: 'Only waiting loads can go in the washer.' };
        if (washerBusy) return { ok: false, reason: 'The washer is busy with "' + washer.name + '".' };
        return { ok: true };
      case 'dry':
        if (load.stage !== 'washer') return { ok: false, reason: 'Only a load in the washer can move to the dryer.' };
        if (dryerBusy) return { ok: false, reason: 'The dryer is busy with "' + dryer.name + '".' };
        return { ok: true };
      case 'finish':
        if (load.stage !== 'dryer') return { ok: false, reason: 'Only a load in the dryer can be finished.' };
        return { ok: true };
      case 'dryAgain':
        if (load.stage === 'dryer') return { ok: true };
        if (load.stage !== 'finished') return { ok: false, reason: 'Only dried loads can be dried again.' };
        if (dryerBusy) return { ok: false, reason: 'The dryer is busy with "' + dryer.name + '".' };
        return { ok: true };
      case 'back':
        if (load.stage === 'waiting') return { ok: false, reason: 'This load is already at the first step.' };
        if (load.stage === 'dryer' && washerBusy) return { ok: false, reason: 'The washer is busy with "' + washer.name + '".' };
        if (load.stage === 'finished' && dryerBusy) return { ok: false, reason: 'The dryer is busy with "' + dryer.name + '".' };
        return { ok: true };
      default:
        return { ok: false, reason: 'Unknown step.' };
    }
  }

  // Moves a load if allowed. Nothing changes when the move isn't allowed.
  function moveLoad(laundry, id, action, today) {
    var load = findLoad(laundry, id);
    if (!load) return { ok: false, reason: 'That load no longer exists.' };
    var check = canMove(laundry, load, action);
    if (!check.ok) return check;

    if (action === 'wash') {
      load.stage = 'washer';
    } else if (action === 'dry') {
      load.stage = 'dryer';
      load.dryCycles = 1;
    } else if (action === 'finish') {
      load.stage = 'finished';
      load.finishedOn = today;
    } else if (action === 'dryAgain') {
      load.stage = 'dryer';
      load.dryCycles += 1;
      unfinish(load);
    } else if (action === 'back') {
      var previous = STAGES[STAGES.indexOf(load.stage) - 1];
      if (load.stage === 'finished') unfinish(load);
      if (previous === 'washer' || previous === 'waiting') load.dryCycles = 0;
      load.stage = previous;
    }
    return { ok: true };
  }

  function unfinish(load) {
    load.finishedOn = null;
    load.putAway = false;
    load.putAwayOn = null;
  }

  // Put away (or undo) a finished load. Its washing stays finished either way.
  function togglePutAway(laundry, id, today) {
    var load = findLoad(laundry, id);
    if (!load || load.stage !== 'finished') return false;
    load.putAway = !load.putAway;
    load.putAwayOn = load.putAway ? today : null;
    return true;
  }

  function renameLoad(laundry, id, name) {
    var load = findLoad(laundry, id);
    var clean = cleanName(name);
    if (!load || !clean) return false;
    load.name = clean;
    return true;
  }

  function deleteLoad(laundry, id) {
    var before = laundry.loads.length;
    laundry.loads = laundry.loads.filter(function (l) { return l.id !== id; });
    return laundry.loads.length < before;
  }

  // Moves finished, put-away loads off the board into the archive.
  function clearPutAway(laundry) {
    var keep = [];
    var moved = 0;
    laundry.loads.forEach(function (load) {
      if (load.stage === 'finished' && load.putAway) {
        laundry.archive.push(load);
        moved++;
      } else {
        keep.push(load);
      }
    });
    laundry.loads = keep;
    return moved;
  }

  function loadsNeedingPutAway(laundry) {
    return laundry.loads.filter(function (l) { return l.stage === 'finished' && !l.putAway; });
  }

  // The numbers shown at the top of the Laundry room.
  function counts(laundry) {
    var c = { waiting: 0, washer: 0, dryer: 0, finished: 0 };
    laundry.loads.forEach(function (l) { c[l.stage]++; });
    return {
      waiting: c.waiting,
      inWasher: c.washer,
      inDryer: c.dryer,
      started: c.washer + c.dryer + c.finished,
      movedToDryer: c.dryer + c.finished,
      finished: c.finished,
      needPutAway: loadsNeedingPutAway(laundry).length,
      total: laundry.loads.length
    };
  }

  global.HouseholdLaundry = {
    STAGES: STAGES,
    STAGE_LABELS: STAGE_LABELS,
    DEFAULT_CATEGORIES: DEFAULT_CATEGORIES,
    createLaundry: createLaundry,
    findLoad: findLoad,
    categoryName: categoryName,
    occupant: occupant,
    addLoad: addLoad,
    canMove: canMove,
    moveLoad: moveLoad,
    togglePutAway: togglePutAway,
    renameLoad: renameLoad,
    deleteLoad: deleteLoad,
    clearPutAway: clearPutAway,
    loadsNeedingPutAway: loadsNeedingPutAway,
    counts: counts
  };
})(typeof window !== 'undefined' ? window : globalThis);
