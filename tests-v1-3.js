/*
 * tests-v1-3.js — automatic checks for version 1.3 (Supplies & organisation).
 * Loaded by tests.html after tests-v1-2.js. Uses made-up sample data only.
 */
(function () {
  'use strict';

  var S = window.HouseholdSchedule;
  var W = window.HouseholdLaundry;
  var H = window.HouseholdStorage;
  var P = window.HouseholdPrep;
  var SUP = window.HouseholdSupplies;
  var L1 = window.HouseholdLogic;

  function canon(value) {
    if (Array.isArray(value)) return '[' + value.map(canon).join(',') + ']';
    if (value && typeof value === 'object') {
      return '{' + Object.keys(value).sort().map(function (k) { return JSON.stringify(k) + ':' + canon(value[k]); }).join(',') + '}';
    }
    return JSON.stringify(value);
  }
  function expectSame(a, b) {
    if (canon(a) !== canon(b)) throw new Error('expected ' + canon(b) + ' but got ' + canon(a));
  }
  function expectTrue(v, m) {
    if (!v) throw new Error(m || 'expected true');
  }
  function copy(v) {
    return JSON.parse(JSON.stringify(v));
  }
  function fakeStorage(initial) {
    var data = copy(initial || {});
    return {
      data: data,
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
      setItem: function (k, v) { data[k] = String(v); }
    };
  }

  var ACTIVATED = '2026-10-25';
  function freshState() {
    return H.createState(ACTIVATED, null);
  }

  // Real v1.2-shaped saved data: no categories, no supply notes, but in use.
  function v12SavedData() {
    var state = freshState();
    delete state.supplyCategories;
    state.supplies = [
      { id: 's1', name: 'Shampoo', done: true },
      { id: 's2', name: 'Cat food', done: false },
      { id: 's3', name: 'Glass cleaner', done: true },
      { id: 's4', name: 'Small trash bags', done: false }
    ];
    S.toggleDone(state, 'bathroom-clean-toilet', '2026-10-24', '2026-10-26');
    S.setNote(state, 'bathroom-change-bathroom-trash', '2026-10-24', 'No bags');
    var load = W.addLoad(state.laundry, 'bedding', null, '2026-10-25');
    W.moveLoad(state.laundry, load.id, 'wash', 'x'); W.moveLoad(state.laundry, load.id, 'dry', 'x'); W.moveLoad(state.laundry, load.id, 'finish', '2026-10-25');
    state.reviews['2026-10-24'] = { reviewedOn: '2026-10-30', updatedOn: '2026-10-30', decisions: {}, counts: { done: 0, carried: 0, notes: 0, supplies: 0 } };
    return state;
  }

  function finish(laundry, id, day) {
    W.moveLoad(laundry, id, 'wash', day); W.moveLoad(laundry, id, 'dry', day); W.moveLoad(laundry, id, 'finish', day);
  }

  // ======================================================================
  section('v1.3 Supplies: categories');

  test('new data has the seven starting categories, with Other last', function () {
    expectEqual(freshState().supplyCategories.map(function (c) { return c.name; }),
      ['Cleaning Supplies', 'Hair Care', 'Body Care', 'Laundry Supplies', 'Cat Supplies', 'Personal Care', 'Other']);
  });

  test('existing v1.2 data loads with categories and every supply unchanged', function () {
    var saved = v12SavedData();
    var storage = fakeStorage({ 'householdReset.v2': JSON.stringify(saved) });
    var loaded = H.loadState(storage, '2026-10-27');
    expectEqual(loaded.source, 'saved');
    expectEqual(loaded.state.supplyCategories.length, 7);
    expectSame(loaded.state.supplies, saved.supplies); // same names, ticks, order; no field added
    expectEqual(S.getRecord(loaded.state, 'bathroom-clean-toilet', '2026-10-24').completedOn, '2026-10-26');
    expectEqual(loaded.state.reviews['2026-10-24'].reviewedOn, '2026-10-30');
    expectEqual(loaded.state.laundry.loads.length, 1);
  });

  test('uncategorised supplies show in Other; nothing is guessed from the name', function () {
    var state = H.loadState(fakeStorage({ 'householdReset.v2': JSON.stringify(v12SavedData()) }), ACTIVATED).state;
    expectEqual(SUP.categoryOf(state, SUP.findSupplyById(state, 's1')), 'other'); // "Shampoo" is not put in Hair Care
    expectEqual(SUP.categoryOf(state, SUP.findSupplyById(state, 's2')), 'other'); // "Cat food" is not put in Cat Supplies
    expectEqual(SUP.itemsIn(state, 'other').length, 4);
    expectSame(SUP.counts(state, 'other'), { total: 4, needed: 2 });
    expectSame(SUP.counts(state, 'hair'), { total: 0, needed: 0 });
  });

  test('custom categories: add (above Other), no duplicate names, rename', function () {
    var state = freshState();
    var c = SUP.addCategory(state, '  Kitchen   Pantry ');
    expectEqual(c.name, 'Kitchen Pantry');
    expectEqual(state.supplyCategories[state.supplyCategories.length - 2].id, c.id);
    expectEqual(state.supplyCategories[state.supplyCategories.length - 1].id, 'other');
    expectEqual(SUP.addCategory(state, 'kitchen pantry'), null);
    expectEqual(SUP.addCategory(state, '   '), null);
    expectEqual(SUP.renameCategory(state, c.id, 'Pantry'), true);
    expectEqual(SUP.findCategory(state, c.id).name, 'Pantry');
    expectEqual(SUP.renameCategory(state, c.id, 'hair care'), false); // taken
  });

  test('reorder categories; Other always stays last', function () {
    var state = freshState();
    expectEqual(SUP.moveCategory(state, 'hair', -1), true);
    expectEqual(state.supplyCategories[0].id, 'hair');
    expectEqual(SUP.moveCategory(state, 'hair', -1), false); // already first
    expectEqual(SUP.moveCategory(state, 'personal', 1), false); // can't go below Other
    expectEqual(SUP.moveCategory(state, 'other', -1), false);
  });

  test('deleting a category moves its supplies to Other; nothing is deleted', function () {
    var state = freshState();
    var c = SUP.addCategory(state, 'Garage');
    SUP.addSupply(state, 'Car wash soap', c.id);
    var n = state.supplies.length;
    expectEqual(SUP.deleteCategory(state, c.id), 1);
    expectEqual(state.supplies.length, n);
    expectEqual(SUP.categoryOf(state, P.findSupply(state, 'Car wash soap')), 'other');
    expectEqual(SUP.deleteCategory(state, 'other'), -1);
  });

  test('moving a supply keeps the same record: no duplicate, tick and note kept', function () {
    var state = freshState();
    var added = SUP.addSupply(state, 'Shampoo', 'other', 'Brand X, gentle').supply;
    added.done = true;
    var n = state.supplies.length;
    SUP.moveSupply(state, added.id, 'hair');
    expectEqual(state.supplies.length, n);
    var moved = SUP.findSupplyById(state, added.id);
    expectEqual(SUP.categoryOf(state, moved), 'hair');
    expectSame([moved.done, moved.note], [true, 'Brand X, gentle']);
    SUP.moveSupply(state, added.id, 'other');
    expectEqual(moved.category, undefined); // Other = no category field
  });

  test('adding a supply that already exists does not duplicate it', function () {
    var state = freshState();
    SUP.addSupply(state, 'Conditioner', 'hair');
    var again = SUP.addSupply(state, '  CONDITIONER ', 'body');
    expectEqual(again.action, 'exists');
    expectEqual(state.supplies.filter(function (s) { return /conditioner/i.test(s.name); }).length, 1);
    expectEqual(SUP.categoryOf(state, again.supply), 'hair'); // not moved by the second add
  });

  // ======================================================================
  section('v1.3 Supplies: notes');

  test('a note stays when the supply is ticked and unticked', function () {
    var state = freshState();
    var s = SUP.addSupply(state, 'Body wash', 'body', 'Lavender scent').supply;
    L1.toggleSupply(s);
    L1.toggleSupply(s);
    expectEqual(s.note, 'Lavender scent');
  });

  test('notes can be edited and removed', function () {
    var state = freshState();
    var s = SUP.addSupply(state, 'Cat food', 'cat').supply;
    SUP.setNote(state, s.id, '  Salmon   formula ');
    expectEqual(s.note, 'Salmon formula');
    SUP.setNote(state, s.id, '');
    expectEqual(s.note, undefined);
  });

  test('categories and notes survive saving, reloading, and a backup', function () {
    var state = freshState();
    var c = SUP.addCategory(state, 'Pantry');
    var s = SUP.addSupply(state, 'Shampoo', 'hair', 'For curly hair').supply;
    SUP.addSupply(state, 'Rice', c.id);
    var storage = fakeStorage({});
    H.saveState(storage, state);
    var loaded = H.loadState(storage, '2026-10-26').state;
    expectSame(loaded.supplyCategories, state.supplyCategories);
    expectEqual(SUP.findSupplyById(loaded, s.id).note, 'For curly hair');
    expectEqual(SUP.findSupplyById(loaded, s.id).category, 'hair');
    var restored = H.validateBackup(JSON.stringify(H.createBackup(loaded, new Date())), '2026-10-27');
    expectEqual(restored.ok, true);
    expectSame(restored.state, loaded);
  });

  test('damaged categories or notes are rejected; a missing category falls back to Other', function () {
    var a = freshState();
    a.supplyCategories = [{ id: 'x' }];
    expectTrue(H.validateState(copy(a)).error.indexOf('supply categories') > -1, 'unnamed category');
    var b = freshState();
    b.supplies[0].note = 42;
    expectEqual(H.validateState(copy(b)).ok, false);
    var c = freshState();
    c.supplies[0].category = 'deleted-category';
    var checked = H.validateState(copy(c));
    expectEqual(checked.ok, true);
    expectEqual(SUP.categoryOf(checked.state, checked.state.supplies[0]), 'other');
  });

  // ======================================================================
  section('v1.3 Supplies and chores');

  test('renaming a supply keeps chore links by updating them to the new name', function () {
    var state = freshState();
    var glass = SUP.addSupply(state, 'Glass cleaner', 'cleaning').supply;
    var result = SUP.renameSupply(state, glass.id, 'Window spray');
    expectSame(result, { ok: true, linksUpdated: 2 }); // both mirror chores
    expectEqual(S.findTask(state, 'bathroom-clean-mirror').supplies, ['Window spray']);
    var prompt = P.prompts(state, '2026-11-02').filter(function (p) { return p.task.id === 'bathroom-clean-mirror'; })[0];
    expectEqual(prompt.supplies[0].supply.id, glass.id); // still finds the same supply
  });

  test('renaming to a name already in use is refused', function () {
    var state = freshState();
    var a = SUP.addSupply(state, 'Sponges').supply;
    SUP.addSupply(state, 'Scrubbers');
    expectEqual(SUP.renameSupply(state, a.id, 'scrubbers').ok, false);
  });

  test('supplies added from a chore can go in a chosen category, or Other', function () {
    var state = freshState();
    var r1 = P.addOrMarkSupply(state, 'Small trash bags', 'cleaning');
    expectEqual(SUP.categoryOf(state, SUP.findSupplyById(state, r1.id)), 'cleaning');
    var r2 = P.addOrMarkSupply(state, 'Lint roller');
    expectEqual(SUP.categoryOf(state, SUP.findSupplyById(state, r2.id)), 'other');
    expectEqual(P.addOrMarkSupply(state, 'small TRASH bags', 'hair').action, 'already'); // no duplicate, no move
    expectEqual(SUP.categoryOf(state, SUP.findSupplyById(state, r1.id)), 'cleaning');
  });

  test('moving or noting a supply never breaks a prep answer or its undo', function () {
    var state = freshState();
    var prompt = P.prompts(state, '2026-11-02').filter(function (p) { return p.task.id === 'whole-house-change-scent-booster-plugins'; })[0];
    P.addToSupplies(state, prompt, '2026-11-02');
    var refills = P.findSupply(state, 'Scent plugin refills');
    SUP.moveSupply(state, refills.id, 'cleaning');
    SUP.setNote(state, refills.id, 'Lavender');
    expectEqual(state.prep[prompt.key].answer, 'added');
    var undo = P.undoAnswer(state, prompt.key);
    expectEqual(undo.undone, true);
    expectEqual(P.findSupply(state, 'Scent plugin refills'), null); // still unticked, so undo removes it as before
  });

  test('a ticked change made after a prep answer is still protected', function () {
    var state = freshState();
    var prompt = P.prompts(state, '2026-11-02').filter(function (p) { return p.task.id === 'whole-house-change-scent-booster-plugins'; })[0];
    P.addToSupplies(state, prompt, '2026-11-02');
    var refills = P.findSupply(state, 'Scent plugin refills');
    SUP.moveSupply(state, refills.id, 'cleaning');
    refills.done = true;
    expectSame(P.undoAnswer(state, prompt.key).kept, ['Scent plugin refills']);
  });

  // ======================================================================
  section('v1.3 Chore editing and history');

  test('renaming a chore keeps its id, schedule start, and completion history', function () {
    var state = freshState();
    S.toggleDone(state, 'bathroom-clean-mirror', '2026-10-24', '2026-10-26');
    S.editTask(state, 'bathroom-clean-mirror', 'Clean big mirror', 'biweekly', '2026-10-24', '2026-11-02');
    var task = S.findTask(state, 'bathroom-clean-mirror');
    expectSame([task.id, task.name, task.since], ['bathroom-clean-mirror', 'Clean big mirror', '2026-10-24']);
    var record = S.getRecord(state, 'bathroom-clean-mirror', '2026-10-24');
    expectSame([record.status, record.completedOn, record.name], ['done', '2026-10-26', 'Clean mirror']); // name when completed
    expectEqual(S.isDueInWeek(task, '2026-11-07'), true);
  });

  test('changing how often a chore repeats still follows the v1.2 safety rule', function () {
    var state = freshState();
    S.editTask(state, 'bathroom-clean-mirror', 'Clean mirror', 'weekly', null, '2026-11-02');
    expectEqual(S.findTask(state, 'bathroom-clean-mirror').since, '2026-10-31');
    expectEqual(S.overdueOccurrences(state, null, '2026-11-02').filter(function (o) { return o.task.id === 'bathroom-clean-mirror'; }).length, 0);
  });

  // ======================================================================
  section('v1.3 Laundry put-away from earlier weeks');

  function bedding(day) {
    var laundry = W.createLaundry();
    var load = W.addLoad(laundry, 'bedding', null, day);
    finish(laundry, load.id, day);
    return { laundry: laundry, load: load };
  }

  test('a load finished Oct 25 and not put away is flagged from Oct 31 on', function () {
    var x = bedding('2026-10-25');
    expectEqual(W.overduePutAway(x.laundry, '2026-10-24').length, 0); // same week: not overdue yet
    expectEqual(W.overduePutAway(x.laundry, '2026-10-31')[0].id, x.load.id);
    expectEqual(W.overduePutAway(x.laundry, '2026-11-14')[0].id, x.load.id); // stays until resolved
  });

  test('putting the load away clears the reminder at once', function () {
    var x = bedding('2026-10-25');
    W.togglePutAway(x.laundry, x.load.id, '2026-11-01');
    expectEqual(W.overduePutAway(x.laundry, '2026-10-31').length, 0);
    expectEqual(x.load.finishedOn, '2026-10-25'); // original finish date kept
  });

  test('loads still in the washer or dryer, or moved back, are not put-away reminders', function () {
    var x = bedding('2026-10-25');
    var other = W.addLoad(x.laundry, 'towels', null, '2026-10-25');
    W.moveLoad(x.laundry, other.id, 'wash', 'x');
    W.moveLoad(x.laundry, x.load.id, 'back', 'x'); // finished -> dryer again
    expectEqual(W.overduePutAway(x.laundry, '2026-10-31').length, 0);
  });

  test('cleared (archived) loads can never be overdue; nothing is duplicated', function () {
    var x = bedding('2026-10-25');
    W.togglePutAway(x.laundry, x.load.id, '2026-10-26');
    W.clearPutAway(x.laundry);
    expectEqual(W.overduePutAway(x.laundry, '2026-11-07').length, 0);
    var y = bedding('2026-10-25');
    expectEqual(W.overduePutAway(y.laundry, '2026-10-31').length, 1);
    expectEqual(W.overduePutAway(y.laundry, '2026-10-31').length, 1); // asking twice adds nothing
    expectEqual(y.laundry.loads.length, 1);
  });

  test('put-away reminders do not change room chore counts or progress', function () {
    var state = freshState();
    var before = S.progressOf(S.occurrencesForWeek(state, null, '2026-10-31', '2026-11-02'));
    var load = W.addLoad(state.laundry, 'bedding', null, '2026-10-25');
    finish(state.laundry, load.id, '2026-10-25');
    expectEqual(W.overduePutAway(state.laundry, '2026-10-31').length, 1);
    expectSame(S.progressOf(S.occurrencesForWeek(state, null, '2026-10-31', '2026-11-02')), before);
    expectEqual(S.overdueOccurrences(state, 'laundry', '2026-11-02').length, 0);
  });

  // ======================================================================
  section('v1.3 Upgrades and older backups');

  test('a v1.1 upgrade gets the categories, with old supplies in Other', function () {
    var v1 = { version: 1, chores: [], supplies: [{ id: 'q1', name: 'Shampoo', done: true }], pets: [], history: {} };
    var state = H.migrateFromV1(v1, ACTIVATED).state;
    expectEqual(state.supplyCategories.length, 7);
    expectSame(state.supplies, v1.supplies);
  });

  test('a v1.2 backup (without categories or notes) restores with defaults', function () {
    var saved = v12SavedData();
    var result = H.validateBackup(JSON.stringify({ app: 'household-reset', backupVersion: 2, exportedAt: 'x', data: saved }), '2026-10-28');
    expectEqual(result.ok, true);
    expectEqual(result.state.supplyCategories.length, 7);
    expectSame(result.state.supplies, saved.supplies);
    expectEqual(result.state.records['bathroom-change-bathroom-trash|2026-10-24'].note, 'No bags');
  });

  test('a v1.1 backup restored into v1.3 data keeps your categories', function () {
    var state = freshState();
    var c = SUP.addCategory(state, 'Pantry');
    var v1 = { app: 'household-reset', backupVersion: 1, exportedAt: 'x',
      data: { version: 1, chores: [], supplies: [{ id: 'q1', name: 'Rice', done: false }], pets: [], history: {} } };
    var result = H.validateBackup(JSON.stringify(v1), '2026-10-28', state);
    expectEqual(result.ok, true);
    expectEqual(result.state.supplyCategories.some(function (x) { return x.id === c.id; }), true);
    expectEqual(SUP.categoryOf(result.state, result.state.supplies[0]), 'other');
  });
})();
