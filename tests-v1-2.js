/*
 * tests-v1-2.js — automatic checks for version 1.2.
 * Loaded by tests.html, which provides section(), test(), and expectEqual().
 * Everything here uses made-up sample data; it never touches real saved lists.
 */
(function () {
  'use strict';

  var S = window.HouseholdSchedule;
  var W = window.HouseholdLaundry;
  var H = window.HouseholdStorage;
  var L1 = window.HouseholdLogic;

  // Compares two values, ignoring the order of keys inside objects.
  function canon(value) {
    if (Array.isArray(value)) return '[' + value.map(canon).join(',') + ']';
    if (value && typeof value === 'object') {
      return '{' + Object.keys(value).sort().map(function (k) {
        return JSON.stringify(k) + ':' + canon(value[k]);
      }).join(',') + '}';
    }
    return JSON.stringify(value);
  }

  function expectSame(actual, expected) {
    if (canon(actual) !== canon(expected)) {
      throw new Error('expected ' + canon(expected) + ' but got ' + canon(actual));
    }
  }

  function expectTrue(value, message) {
    if (!value) throw new Error(message || 'expected true');
  }

  function copy(value) {
    return JSON.parse(JSON.stringify(value));
  }

  // Every week start (Saturday) from `from` to `to` where the task is due.
  function dueWeeks(task, from, to) {
    var weeks = [];
    for (var w = from; w <= to; w = S.addWeeks(w, 1)) {
      if (S.isDueInWeek(task, w)) weeks.push(w);
    }
    return weeks;
  }

  // A pretend localStorage, so tests never touch the real one.
  function fakeStorage(initial) {
    var data = copy(initial || {});
    return {
      data: data,
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
      setItem: function (k, v) { data[k] = String(v); },
      removeItem: function (k) { delete data[k]; }
    };
  }

  // Version 1.2 activated on Sunday 25 Oct 2026 (cleaning week of Sat 24 Oct).
  var ACTIVATED = '2026-10-25';
  function freshState() {
    return H.createState(ACTIVATED, null);
  }

  // A realistic version 1.1 saved state, like the one on a real iPad.
  var V1_FIXTURE = {
    version: 1,
    chores: [
      { id: 'c1', name: 'Vacuum floors', recurring: true, doneWeek: '2026-W43' },
      { id: 'c2', name: 'Mop floors', recurring: true, doneWeek: null },
      { id: 'c3', name: 'Clean the shower', recurring: true, doneWeek: '2026-W43' },
      { id: 'c4', name: 'Water the plants', recurring: true, doneWeek: null },
      { id: 'c5', name: 'Fix the shelf', recurring: false, doneWeek: null }
    ],
    supplies: [
      { id: 's1', name: 'Dish soap', done: true },
      { id: 's2', name: 'Cat litter', done: false },
      { id: 's3', name: 'Oat milk', done: true }
    ],
    pets: [
      { id: 'p1', name: 'Feed Cat 1 breakfast', doneDay: '2026-10-25' },
      { id: 'p2', name: 'Brush both cats', doneDay: null }
    ],
    history: {
      '2026-W41': { weekStart: '2026-10-05', done: 7, total: 11, completed: ['Vacuum floors', 'Mop floors'] },
      '2026-W42': { weekStart: '2026-10-12', done: 9, total: 11, completed: ['Vacuum floors'] },
      '2026-W43': { weekStart: '2026-10-19', done: 2, total: 5, completed: ['Vacuum floors', 'Clean the shower'] }
    }
  };

  // ======================================================================
  section('Saturday–Friday cleaning weeks');

  test('every day maps to the Saturday that starts its week', function () {
    expectEqual(S.weekStart('2026-10-24'), '2026-10-24'); // Saturday
    expectEqual(S.weekStart('2026-10-25'), '2026-10-24'); // Sunday
    expectEqual(S.weekStart('2026-10-30'), '2026-10-24'); // Friday
    expectEqual(S.weekStart('2026-10-31'), '2026-10-31'); // next Saturday
    expectEqual(S.weekEnd('2026-10-24'), '2026-10-30');
  });

  test('weeks cross New Year correctly', function () {
    expectEqual(S.weekStart('2027-01-01'), '2026-12-26');
    expectEqual(S.weekStart('2026-12-31'), '2026-12-26');
    expectEqual(S.addWeeks('2026-12-26', 1), '2027-01-02');
    expectEqual(S.weeksBetween('2026-10-24', '2027-01-02'), 10);
  });

  test('daylight-saving changes do not shift weeks', function () {
    expectEqual(S.addWeeks('2026-10-31', 1), '2026-11-07'); // clocks change 1 Nov 2026 (US)
    expectEqual(S.addWeeks('2027-03-13', 1), '2027-03-20'); // clocks change 14 Mar 2027 (US)
    expectEqual(S.addWeeks('2026-03-28', 1), '2026-04-04'); // clocks change 29 Mar 2026 (UK/EU)
    expectEqual(S.todayText(new Date(2026, 10, 1, 1, 30)), '2026-11-01');
  });

  test('leap years and impossible dates are handled', function () {
    expectEqual(S.isDateText('2028-02-29'), true);
    expectEqual(S.isDateText('2026-02-29'), false);
    expectEqual(S.isDateText('2026-13-01'), false);
    expectEqual(S.weekStart('2028-02-29'), '2028-02-26');
  });

  test('the week range is shown Saturday to Friday', function () {
    var text = S.formatWeekRange('2026-10-24');
    expectTrue(text.indexOf('Oct 24') > -1 && text.indexOf('Oct 30') > -1 && text.indexOf('2026') > -1, text);
  });

  // ======================================================================
  section('Frequency rules');

  test('biweekly: every second week from 24 Oct 2026', function () {
    var task = { frequency: 'biweekly', anchor: '2026-10-24' };
    expectEqual(dueWeeks(task, '2026-10-10', '2026-11-21'),
      ['2026-10-10', '2026-10-24', '2026-11-07', '2026-11-21']);
  });

  test('biweekly: rotation stays fixed across month and year boundaries', function () {
    var task = { frequency: 'biweekly', anchor: '2026-10-24' };
    expectEqual(dueWeeks(task, '2026-11-28', '2027-02-06'),
      ['2026-12-05', '2026-12-19', '2027-01-02', '2027-01-16', '2027-01-30']);
  });

  test('biweekly: the other rotation starts on 31 Oct', function () {
    var task = { frequency: 'biweekly', anchor: '2026-10-31' };
    expectEqual(dueWeeks(task, '2026-10-24', '2026-11-14'), ['2026-10-31', '2026-11-14']);
  });

  test('monthly: the week starting on the first Saturday of each month', function () {
    var task = { frequency: 'monthly' };
    expectEqual(dueWeeks(task, '2026-09-26', '2027-02-27'),
      ['2026-10-03', '2026-11-07', '2026-12-05', '2027-01-02', '2027-02-06']);
  });

  test('monthly: a week that only spills into a new month does not count', function () {
    // The week of Sat 27 Feb 2027 includes 1 March, but March's first Saturday is 6 March.
    expectEqual(S.isDueInWeek({ frequency: 'monthly' }, '2027-02-27'), false);
    expectEqual(S.isDueInWeek({ frequency: 'monthly' }, '2027-03-06'), true);
  });

  test('monthly: only one week per month, even when Saturdays fall on the 1st and 8th', function () {
    expectEqual(dueWeeks({ frequency: 'monthly' }, '2026-08-01', '2026-08-29'), ['2026-08-01']);
    expectEqual(dueWeeks({ frequency: 'quarterly' }, '2026-07-04', '2026-07-25'), ['2026-07-04']);
  });

  test('quarterly: first Saturday of Oct, Jan, Apr, Jul', function () {
    var task = { frequency: 'quarterly' };
    expectEqual(dueWeeks(task, '2026-09-26', '2027-12-25'),
      ['2026-10-03', '2027-01-02', '2027-04-03', '2027-07-03', '2027-10-02']);
  });

  test('as needed: never scheduled', function () {
    expectEqual(dueWeeks({ frequency: 'asneeded' }, '2026-10-24', '2027-10-23'), []);
  });

  // ======================================================================
  section('Approved room chore lists');

  test('the seven rooms, with no Hallway', function () {
    expectEqual(S.ROOMS.map(function (r) { return r.name; }),
      ['Bathroom', 'Kitchen', 'Living Room', 'Bedroom', 'Laundry', 'Cat Litter Room', 'Whole House']);
  });

  test('each room starts with the approved number of chores', function () {
    var tasks = freshState().tasks;
    var counts = {};
    tasks.forEach(function (t) { counts[t.room] = (counts[t.room] || 0) + 1; });
    expectSame(counts, { bathroom: 9, kitchen: 12, 'living-room': 10, bedroom: 8, 'cat-litter-room': 2, 'whole-house': 1 });
  });

  test('chores have the approved frequencies', function () {
    function freq(name) {
      return freshState().tasks.filter(function (t) { return t.name === name; })[0].frequency;
    }
    expectEqual(freq('Clean toilet'), 'weekly');
    expectEqual(freq('Wash floor mats'), 'biweekly');
    expectEqual(freq('Deep clean shower/tub'), 'monthly');
    expectEqual(freq('Mop bathroom floor'), 'quarterly');
    expectEqual(freq('Organize pantry'), 'asneeded');
    expectEqual(freq('Sort the mail'), 'weekly');
    expectEqual(freq('Dust ceiling fan / light fixtures'), 'quarterly');
    expectEqual(freq('Strip bedding & wash sheets/comforter'), 'biweekly');
    expectEqual(freq('Change scent booster plugins'), 'monthly');
  });

  test('shower deep clean is one chore, and sheets/comforter is one chore', function () {
    var names = freshState().tasks.map(function (t) { return t.name; });
    expectEqual(names.filter(function (n) { return /shower/i.test(n); }), ['Deep clean shower/tub', 'Wash shower curtains']);
    expectEqual(names.filter(function (n) { return /sheets|comforter/i.test(n); }).length, 1);
  });

  test('shower deep clean and shower curtains are due in the same weeks', function () {
    var state = freshState();
    function bathroomNames(week) {
      return S.occurrencesForWeek(state, 'bathroom', week, '2026-11-07').map(function (o) { return o.task.name; });
    }
    ['2026-11-07', '2026-12-05', '2027-01-02'].forEach(function (week) {
      var names = bathroomNames(week);
      expectTrue(names.indexOf('Deep clean shower/tub') > -1 && names.indexOf('Wash shower curtains') > -1, week);
    });
    var other = bathroomNames('2026-11-14');
    expectTrue(other.indexOf('Deep clean shower/tub') === -1 && other.indexOf('Wash shower curtains') === -1, 'not in 14 Nov');
  });

  // ======================================================================
  section('Overdue chores and completion history');

  test('nothing is overdue when version 1.2 is first activated', function () {
    expectEqual(S.overdueOccurrences(freshState(), null, ACTIVATED).length, 0);
    var friday = H.createState('2026-10-30', null);
    expectEqual(S.overdueOccurrences(friday, null, '2026-10-30').length, 0);
  });

  test('weeks before activation have no chores and no overdue items', function () {
    expectEqual(S.occurrencesForWeek(freshState(), null, '2026-10-17', ACTIVATED).length, 0);
  });

  test('a missed chore stays overdue with its original due week', function () {
    var overdue = S.overdueOccurrences(freshState(), 'bathroom', '2026-11-02').filter(function (o) {
      return o.task.id === 'bathroom-clean-toilet';
    });
    expectEqual(overdue.map(function (o) { return o.week; }), ['2026-10-24']);
  });

  test('several missed weeks each appear once, with no duplicates', function () {
    var state = freshState();
    function toiletWeeks() {
      return S.overdueOccurrences(state, null, '2026-11-16')
        .filter(function (o) { return o.task.id === 'bathroom-clean-toilet'; })
        .map(function (o) { return o.week; });
    }
    expectEqual(toiletWeeks(), ['2026-10-24', '2026-10-31', '2026-11-07']);
    expectEqual(toiletWeeks(), ['2026-10-24', '2026-10-31', '2026-11-07']); // asking again adds nothing
    expectSame(state.records, {}); // and nothing was saved
  });

  test('completing late saves the real date and keeps the scheduled week', function () {
    var state = freshState();
    S.toggleDone(state, 'bathroom-clean-toilet', '2026-10-24', '2026-11-16');
    var record = S.getRecord(state, 'bathroom-clean-toilet', '2026-10-24');
    expectEqual(record.status, 'done');
    expectEqual(record.week, '2026-10-24');
    expectEqual(record.completedOn, '2026-11-16');
    var left = S.overdueOccurrences(state, null, '2026-11-16').filter(function (o) { return o.task.id === 'bathroom-clean-toilet'; });
    expectEqual(left.map(function (o) { return o.week; }), ['2026-10-31', '2026-11-07']);
  });

  test('late completion does not shift a recurring rotation', function () {
    var state = freshState();
    S.toggleDone(state, 'bathroom-clean-mirror', '2026-10-24', '2026-11-02'); // done 9 days late
    expectEqual(S.nextDueWeek(state, S.findTask(state, 'bathroom-clean-mirror'), '2026-11-02'), '2026-11-07');
  });

  test('a new week does not erase last week’s missed chore', function () {
    var state = freshState();
    var thisWeek = S.occurrencesForWeek(state, 'bathroom', '2026-10-31', '2026-11-02');
    expectTrue(thisWeek.some(function (o) { return o.task.id === 'bathroom-clean-toilet' && o.status === 'due'; }), 'due now');
    var overdue = S.overdueOccurrences(state, 'bathroom', '2026-11-02');
    expectTrue(overdue.some(function (o) { return o.task.id === 'bathroom-clean-toilet' && o.week === '2026-10-24'; }), 'still overdue');
  });

  test('as-needed chores never become overdue', function () {
    var overdue = S.overdueOccurrences(freshState(), null, '2027-06-01');
    expectEqual(overdue.filter(function (o) { return o.task.frequency === 'asneeded'; }).length, 0);
  });

  test('skipping a missed chore records it as skipped, not done', function () {
    var state = freshState();
    S.toggleSkip(state, 'bathroom-clean-toilet', '2026-10-24');
    expectEqual(S.getRecord(state, 'bathroom-clean-toilet', '2026-10-24').status, 'skipped');
    expectEqual(S.getRecord(state, 'bathroom-clean-toilet', '2026-10-24').completedOn, undefined);
    var overdue = S.overdueOccurrences(state, null, '2026-11-02').filter(function (o) { return o.task.id === 'bathroom-clean-toilet'; });
    expectEqual(overdue.length, 0);
  });

  test('skip all overdue in a room', function () {
    var state = freshState();
    var skipped = S.skipAllOverdue(state, 'kitchen', '2026-11-16');
    expectTrue(skipped > 0, 'some skipped');
    expectEqual(S.overdueOccurrences(state, 'kitchen', '2026-11-16').length, 0);
    expectTrue(S.overdueOccurrences(state, 'bathroom', '2026-11-16').length > 0, 'other rooms untouched');
  });

  test('moving a chore to a later week, then missing it, keeps its original due week', function () {
    var state = freshState();
    expectEqual(S.moveOccurrence(state, 'bathroom-clean-toilet', '2026-10-24', '2026-11-21', '2026-11-16'), true);
    var inNov21 = S.occurrencesForWeek(state, 'bathroom', '2026-11-21', '2026-11-16')
      .filter(function (o) { return o.task.id === 'bathroom-clean-toilet'; });
    expectEqual(inNov21.map(function (o) { return o.week; }).sort(), ['2026-10-24', '2026-11-21']);
    var overdueNow = S.overdueOccurrences(state, null, '2026-11-16').filter(function (o) { return o.week === '2026-10-24' && o.task.id === 'bathroom-clean-toilet'; });
    expectEqual(overdueNow.length, 0);
    var overdueLater = S.overdueOccurrences(state, null, '2026-11-30').filter(function (o) { return o.week === '2026-10-24' && o.task.id === 'bathroom-clean-toilet'; });
    expectEqual(overdueLater.length, 1);
  });

  test('chores cannot be moved into a past week', function () {
    var state = freshState();
    expectEqual(S.moveOccurrence(state, 'bathroom-clean-toilet', '2026-11-14', '2026-10-31', '2026-11-16'), false);
    expectSame(state.records, {});
  });

  test('looking at other weeks never changes saved data', function () {
    var state = freshState();
    S.toggleDone(state, 'kitchen-clean-oven', '2027-01-02', '2026-10-26');
    var before = canon(state);
    for (var w = '2026-09-05'; w < '2027-03-01'; w = S.addWeeks(w, 1)) {
      S.occurrencesForWeek(state, null, w, '2026-11-16');
      S.overview(state, w, '2026-11-16');
      S.weekHistory(state, w, '2026-11-16');
    }
    S.upcoming(state, '2026-11-16');
    S.overdueOccurrences(state, null, '2026-11-16');
    expectEqual(canon(state), before);
  });

  test('room progress counts done chores due in the selected week', function () {
    var state = freshState();
    S.toggleDone(state, 'cat-litter-room-scoop-litter', '2026-10-24', ACTIVATED);
    expectSame(S.progressOf(S.occurrencesForWeek(state, 'cat-litter-room', '2026-10-24', ACTIVATED)), { done: 1, total: 2, percent: 50 });
  });

  test('history shows done, skipped, and missed chores for a past week', function () {
    var state = freshState();
    S.toggleDone(state, 'cat-litter-room-scoop-litter', '2026-10-24', '2026-10-26');
    S.toggleSkip(state, 'cat-litter-room-vacuum-floor', '2026-10-24');
    var week = S.weekHistory(state, '2026-10-24', '2026-11-02');
    expectTrue(week.done.some(function (o) { return o.record.completedOn === '2026-10-26'; }), 'done with date');
    expectEqual(week.skipped.length, 1);
    expectTrue(week.missed.length > 0, 'missed listed');
  });

  test('upcoming lists less-frequent chores after this week, soonest first', function () {
    var list = S.upcoming(freshState(), ACTIVATED, 14);
    expectTrue(list.every(function (u) { return u.task.frequency !== 'weekly'; }), 'no weekly');
    expectTrue(list.every(function (u) { return u.week > '2026-10-24'; }), 'nothing from this week');
    expectEqual(list[0].week, '2026-11-07'); // biweekly and monthly chores in two weeks
    var mirror = list.filter(function (u) { return u.task.name === 'Clean mirror'; })[0];
    expectEqual(mirror.week, '2026-11-07'); // due this week too, but upcoming shows the next one
    var oven = list.filter(function (u) { return u.task.name === 'Clean oven'; })[0];
    expectEqual(oven.week, '2027-01-02');
    var shower = list.filter(function (u) { return u.task.name === 'Deep clean shower/tub'; })[0];
    expectEqual(shower.week, '2026-11-07');
  });

  // ======================================================================
  section('Adding, editing, and deleting room chores');

  test('add a chore to a room', function () {
    var state = freshState();
    var task = S.addTask(state, 'kitchen', '  Descale   kettle ', 'monthly', null, '2026-11-16');
    expectEqual(task.name, 'Descale kettle');
    expectEqual(task.since, '2026-11-14');
    expectTrue(S.findTask(state, task.id) !== null, 'saved');
  });

  test('blank names and unknown rooms are refused', function () {
    var state = freshState();
    expectEqual(S.addTask(state, 'kitchen', '   ', 'weekly', null, ACTIVATED), null);
    expectEqual(S.addTask(state, 'hallway', 'Sweep', 'weekly', null, ACTIVATED), null);
    expectEqual(S.addTask(state, 'kitchen', 'Sweep', 'daily', null, ACTIVATED), null);
    expectEqual(state.tasks.length, 42);
  });

  test('a chore added later is not overdue for earlier weeks', function () {
    var state = freshState();
    var task = S.addTask(state, 'kitchen', 'Wipe the fridge door', 'weekly', null, '2026-11-16');
    expectEqual(S.overdueOccurrences(state, null, '2026-11-16').filter(function (o) { return o.task === task; }).length, 0);
  });

  test('new biweekly chores use the 24 Oct rotation unless another is chosen', function () {
    var state = freshState();
    expectEqual(S.addTask(state, 'bedroom', 'Flip mattress', 'biweekly', null, ACTIVATED).anchor, '2026-10-24');
    expectEqual(S.addTask(state, 'bedroom', 'Dust lamp', 'biweekly', '2026-10-31', ACTIVATED).anchor, '2026-10-31');
  });

  test('edit a chore name and frequency without creating past overdue items', function () {
    var state = freshState();
    expectEqual(S.editTask(state, 'kitchen-clean-oven', 'Clean oven racks', 'weekly', null, '2026-11-16'), true);
    var task = S.findTask(state, 'kitchen-clean-oven');
    expectEqual(task.name, 'Clean oven racks');
    expectEqual(task.since, '2026-11-14');
    expectEqual(S.overdueOccurrences(state, null, '2026-11-16').filter(function (o) { return o.task === task; }).length, 0);
  });

  test('renaming keeps the schedule start date', function () {
    var state = freshState();
    S.editTask(state, 'bathroom-clean-toilet', 'Clean the toilet', 'weekly', null, '2026-11-16');
    expectEqual(S.findTask(state, 'bathroom-clean-toilet').since, '2026-10-24');
  });

  test('deleting a chore keeps its completed history', function () {
    var state = freshState();
    S.toggleDone(state, 'bathroom-wash-floor-mats', '2026-10-24', '2026-10-25');
    expectEqual(S.deleteTask(state, 'bathroom-wash-floor-mats'), true);
    expectEqual(S.findTask(state, 'bathroom-wash-floor-mats'), null);
    var week = S.weekHistory(state, '2026-10-24', '2026-11-02');
    expectTrue(week.done.some(function (o) { return o.task.name === 'Wash floor mats'; }), 'still in history');
  });

  test('as-needed chores can be done any time and undone the same day', function () {
    var state = freshState();
    S.markAsNeededDone(state, 'kitchen-organize-pantry', '2026-11-03');
    expectEqual(S.lastDone(state, 'kitchen-organize-pantry'), '2026-11-03');
    expectEqual(S.undoAsNeededToday(state, 'kitchen-organize-pantry', '2026-11-03'), true);
    expectEqual(S.lastDone(state, 'kitchen-organize-pantry'), null);
    expectEqual(S.markAsNeededDone(state, 'bathroom-clean-toilet', '2026-11-03'), false); // not an as-needed chore
  });

  // ======================================================================
  section('Laundry tracker');

  function laundryWith(names) {
    var laundry = W.createLaundry();
    var loads = names.map(function (n) { return W.addLoad(laundry, n[0], n[1], '2026-10-25'); });
    return { laundry: laundry, loads: loads };
  }

  test('three default categories', function () {
    expectEqual(W.createLaundry().categories.map(function (c) { return c.name; }),
      ['Regular clothes', 'Bedding', 'Towels & throw blankets']);
  });

  test('several loads in the same category, with editable names', function () {
    var x = laundryWith([['regular'], ['regular'], ['bedding', 'Guest bed']]);
    expectEqual(x.loads.map(function (l) { return l.name; }), ['Regular clothes 1', 'Regular clothes 2', 'Guest bed']);
    expectEqual(W.renameLoad(x.laundry, x.loads[0].id, 'Work clothes'), true);
    expectEqual(x.loads[0].name, 'Work clothes');
    expectEqual(W.addLoad(x.laundry, 'socks', null, '2026-10-25'), null);
  });

  test('a load moves waiting → washer → dryer → finished', function () {
    var x = laundryWith([['towels']]);
    var id = x.loads[0].id;
    ['wash', 'dry', 'finish'].forEach(function (step) {
      expectEqual(W.moveLoad(x.laundry, id, step, '2026-10-26').ok, true);
    });
    expectEqual(x.loads[0].stage, 'finished');
    expectEqual(x.loads[0].finishedOn, '2026-10-26');
    expectEqual(x.loads[0].dryCycles, 1);
  });

  test('steps cannot be skipped', function () {
    var x = laundryWith([['regular']]);
    expectEqual(W.moveLoad(x.laundry, x.loads[0].id, 'dry', '2026-10-26').ok, false);
    expectEqual(W.moveLoad(x.laundry, x.loads[0].id, 'finish', '2026-10-26').ok, false);
    expectEqual(x.loads[0].stage, 'waiting');
  });

  test('only one load can be in the washer', function () {
    var x = laundryWith([['regular'], ['bedding']]);
    W.moveLoad(x.laundry, x.loads[0].id, 'wash', '2026-10-26');
    var result = W.moveLoad(x.laundry, x.loads[1].id, 'wash', '2026-10-26');
    expectEqual(result.ok, false);
    expectTrue(result.reason.indexOf('washer is busy') > -1, result.reason);
    expectEqual(x.loads[1].stage, 'waiting');
  });

  test('only one load can be in the dryer, until it is free', function () {
    var x = laundryWith([['regular'], ['bedding']]);
    var a = x.loads[0].id, b = x.loads[1].id;
    W.moveLoad(x.laundry, a, 'wash', 'd'); W.moveLoad(x.laundry, a, 'dry', 'd');
    W.moveLoad(x.laundry, b, 'wash', 'd');
    expectEqual(W.moveLoad(x.laundry, b, 'dry', 'd').ok, false);
    expectEqual(x.loads[1].stage, 'washer');
    W.moveLoad(x.laundry, a, 'finish', '2026-10-26');
    expectEqual(W.moveLoad(x.laundry, b, 'dry', 'd').ok, true);
  });

  test('extra drying cycles are allowed', function () {
    var x = laundryWith([['bedding'], ['regular']]);
    var a = x.loads[0].id;
    W.moveLoad(x.laundry, a, 'wash', 'd'); W.moveLoad(x.laundry, a, 'dry', 'd');
    W.moveLoad(x.laundry, a, 'dryAgain', 'd');
    expectEqual(x.loads[0].dryCycles, 2);
    W.moveLoad(x.laundry, a, 'finish', '2026-10-26');
    expectEqual(W.moveLoad(x.laundry, a, 'dryAgain', 'd').ok, true); // still damp after finishing
    expectEqual(x.loads[0].stage, 'dryer');
    expectEqual(x.loads[0].dryCycles, 3);
    expectEqual(x.loads[0].finishedOn, null);
  });

  test('mistakes can be corrected by moving back a step', function () {
    var x = laundryWith([['regular'], ['towels']]);
    var a = x.loads[0].id, b = x.loads[1].id;
    W.moveLoad(x.laundry, a, 'wash', 'd'); W.moveLoad(x.laundry, a, 'dry', 'd'); W.moveLoad(x.laundry, a, 'finish', '2026-10-26');
    W.togglePutAway(x.laundry, a, '2026-10-26');
    expectEqual(W.moveLoad(x.laundry, a, 'back', 'd').ok, true); // finished -> dryer
    expectEqual(x.loads[0].stage, 'dryer');
    expectEqual(x.loads[0].putAway, false);
    W.moveLoad(x.laundry, b, 'wash', 'd');
    expectEqual(W.moveLoad(x.laundry, a, 'back', 'd').ok, false); // washer busy with b
    W.moveLoad(x.laundry, b, 'back', 'd'); // b back to waiting
    expectEqual(W.moveLoad(x.laundry, a, 'back', 'd').ok, true); // dryer -> washer
    expectEqual(W.moveLoad(x.laundry, a, 'back', 'd').ok, true); // washer -> waiting
    expectEqual(W.moveLoad(x.laundry, a, 'back', 'd').ok, false); // already first step
  });

  test('counts started, moved to dryer, finished, and waiting loads', function () {
    var x = laundryWith([['regular'], ['regular'], ['bedding'], ['towels']]);
    var ids = x.loads.map(function (l) { return l.id; });
    W.moveLoad(x.laundry, ids[0], 'wash', 'd'); W.moveLoad(x.laundry, ids[0], 'dry', 'd'); W.moveLoad(x.laundry, ids[0], 'finish', '2026-10-26');
    W.moveLoad(x.laundry, ids[1], 'wash', 'd'); W.moveLoad(x.laundry, ids[1], 'dry', 'd');
    W.moveLoad(x.laundry, ids[2], 'wash', 'd');
    expectSame(W.counts(x.laundry), {
      waiting: 1, inWasher: 1, inDryer: 1, started: 3, movedToDryer: 2, finished: 1, needPutAway: 1, total: 4
    });
  });

  test('putting away is separate from finishing', function () {
    var x = laundryWith([['regular'], ['bedding']]);
    var a = x.loads[0].id;
    expectEqual(W.togglePutAway(x.laundry, a, 'd'), false); // not washed yet
    W.moveLoad(x.laundry, a, 'wash', 'd'); W.moveLoad(x.laundry, a, 'dry', 'd'); W.moveLoad(x.laundry, a, 'finish', '2026-10-26');
    expectEqual(W.loadsNeedingPutAway(x.laundry).length, 1);
    W.togglePutAway(x.laundry, a, '2026-10-27');
    expectEqual(x.loads[0].stage, 'finished');
    expectEqual(x.loads[0].putAwayOn, '2026-10-27');
    expectEqual(W.counts(x.laundry).finished, 1);
    expectEqual(W.loadsNeedingPutAway(x.laundry).length, 0);
  });

  test('clearing put-away loads archives them instead of deleting them', function () {
    var x = laundryWith([['regular'], ['bedding']]);
    var a = x.loads[0].id;
    W.moveLoad(x.laundry, a, 'wash', 'd'); W.moveLoad(x.laundry, a, 'dry', 'd'); W.moveLoad(x.laundry, a, 'finish', '2026-10-26');
    W.togglePutAway(x.laundry, a, '2026-10-27');
    expectEqual(W.clearPutAway(x.laundry), 1);
    expectEqual(x.laundry.loads.length, 1);
    expectEqual(x.laundry.archive[0].id, a);
  });

  test('finishing laundry does not tick off any room chores', function () {
    var state = freshState();
    var load = W.addLoad(state.laundry, 'bedding', null, ACTIVATED);
    W.moveLoad(state.laundry, load.id, 'wash', ACTIVATED);
    W.moveLoad(state.laundry, load.id, 'dry', ACTIVATED);
    W.moveLoad(state.laundry, load.id, 'finish', ACTIVATED);
    expectSame(state.records, {});
    var bedroom = S.occurrencesForWeek(state, 'bedroom', '2026-10-24', ACTIVATED);
    expectEqual(bedroom.filter(function (o) { return o.status === 'done'; }).length, 0);
  });

  // ======================================================================
  section('Upgrading from version 1.1');

  test('Supplies and Cats are kept exactly', function () {
    var state = H.migrateFromV1(copy(V1_FIXTURE), ACTIVATED).state;
    expectSame(state.supplies, V1_FIXTURE.supplies);
    expectSame(state.pets, V1_FIXTURE.pets);
  });

  test('the old chore list and weekly history are archived unchanged', function () {
    var state = H.migrateFromV1(copy(V1_FIXTURE), ACTIVATED).state;
    expectSame(state.legacy.chores, V1_FIXTURE.chores);
    expectSame(state.legacy.history, V1_FIXTURE.history);
    expectEqual(state.legacy.archivedOn, ACTIVATED);
  });

  test('old generic chores are not copied into the new rooms', function () {
    var names = H.migrateFromV1(copy(V1_FIXTURE), ACTIVATED).state.tasks.map(function (t) { return t.name; });
    expectEqual(names.length, 42);
    ['Vacuum floors', 'Mop floors', 'Clean the shower', 'Water the plants', 'Fix the shelf'].forEach(function (old) {
      expectTrue(names.indexOf(old) === -1, old + ' was copied');
    });
  });

  test('no completion history is invented for the new chores', function () {
    var state = H.migrateFromV1(copy(V1_FIXTURE), ACTIVATED).state;
    expectSame(state.records, {});
    expectEqual(state.asNeeded.length, 0);
    expectEqual(S.overdueOccurrences(state, null, ACTIVATED).length, 0);
  });

  test('upgrade reads 1.1 data but never changes it, and leaves other data alone', function () {
    var v1Text = JSON.stringify(V1_FIXTURE);
    var storage = fakeStorage({ 'householdReset.v1': v1Text, 'someOtherApp': 'keep me' });
    var loaded = H.loadState(storage, ACTIVATED);
    expectEqual(loaded.source, 'migrated');
    H.saveState(storage, loaded.state);
    expectEqual(storage.data['householdReset.v1'], v1Text);
    expectEqual(storage.data.someOtherApp, 'keep me');
    expectTrue(typeof storage.data['householdReset.v2'] === 'string', 'v2 saved');
  });

  test('opening the app again does not upgrade twice or duplicate chores', function () {
    var storage = fakeStorage({ 'householdReset.v1': JSON.stringify(V1_FIXTURE) });
    var first = H.loadState(storage, ACTIVATED);
    S.toggleDone(first.state, 'bathroom-clean-toilet', '2026-10-24', ACTIVATED);
    H.saveState(storage, first.state);
    for (var i = 0; i < 3; i++) {
      var again = H.loadState(storage, '2026-11-20');
      expectEqual(again.source, 'saved');
      expectEqual(again.state.tasks.length, 42);
      expectEqual(again.state.activatedOn, ACTIVATED);
      expectEqual(S.getRecord(again.state, 'bathroom-clean-toilet', '2026-10-24').status, 'done');
      H.saveState(storage, again.state);
    }
  });

  test('a first visit with no 1.1 data starts fresh without an archive', function () {
    var loaded = H.loadState(fakeStorage({}), ACTIVATED);
    expectEqual(loaded.source, 'new');
    expectEqual(loaded.state.legacy, null);
    expectEqual(loaded.state.supplies.length, 10);
  });

  test('damaged 1.1 data is left untouched and saving waits for a decision', function () {
    var storage = fakeStorage({ 'householdReset.v1': '{not valid json' });
    var loaded = H.loadState(storage, ACTIVATED);
    expectEqual(loaded.problem, true);
    expectEqual(loaded.source, 'damaged');
    expectEqual(loaded.canSave, false);
    expectTrue(loaded.state.legacy.note.indexOf('untouched') > -1, 'note');
    expectEqual(storage.data['householdReset.v1'], '{not valid json');
  });

  test('damaged 1.2 data is kept as a safety copy before anything else', function () {
    var storage = fakeStorage({ 'householdReset.v1': JSON.stringify(V1_FIXTURE), 'householdReset.v2': '{"version": 2, "tasks": "oops"}' });
    var loaded = H.loadState(storage, ACTIVATED);
    expectEqual(loaded.damagedCopy, true);
    expectEqual(storage.data['householdReset.v2.damaged'], '{"version": 2, "tasks": "oops"}');
    expectEqual(loaded.source, 'damaged');
    expectEqual(loaded.needsDecision, true);
  });

  test('if storage cannot be read, saving is switched off', function () {
    var broken = { getItem: function () { throw new Error('blocked'); }, setItem: function () { throw new Error('blocked'); } };
    var loaded = H.loadState(broken, ACTIVATED);
    expectEqual(loaded.canSave, false);
    expectEqual(H.saveState(broken, loaded.state), false);
  });

  // ======================================================================
  section('Backups');

  // A well-used version 1.2 state: completions, skips, moves, laundry, archive.
  function usedState() {
    var state = H.migrateFromV1(copy(V1_FIXTURE), ACTIVATED).state;
    S.toggleDone(state, 'bathroom-clean-toilet', '2026-10-24', '2026-10-26');
    S.toggleSkip(state, 'kitchen-clean-kitchen-sink', '2026-10-24');
    S.moveOccurrence(state, 'bedroom-clean-bedroom-mirror', '2026-10-24', '2026-11-07', '2026-10-26');
    S.markAsNeededDone(state, 'kitchen-organize-pantry', '2026-10-27');
    S.addTask(state, 'laundry', 'Clean lint trap', 'weekly', null, '2026-10-26');
    var a = W.addLoad(state.laundry, 'regular', null, '2026-10-26');
    var b = W.addLoad(state.laundry, 'bedding', null, '2026-10-26');
    W.addLoad(state.laundry, 'towels', 'Beach towels', '2026-10-26');
    W.moveLoad(state.laundry, a.id, 'wash', 'x'); W.moveLoad(state.laundry, a.id, 'dry', 'x'); W.moveLoad(state.laundry, a.id, 'finish', '2026-10-26');
    W.moveLoad(state.laundry, b.id, 'wash', 'x');
    return state;
  }

  test('a 1.2 backup contains every part of the data', function () {
    var backup = H.createBackup(usedState(), new Date(2026, 9, 27, 9, 0));
    expectEqual(backup.backupVersion, 2);
    ['tasks', 'records', 'asNeeded', 'laundry', 'supplies', 'pets', 'legacy', 'activatedWeek'].forEach(function (k) {
      expectTrue(backup.data[k] !== undefined, k + ' missing');
    });
  });

  test('a 1.2 backup restores exactly what was saved', function () {
    var original = usedState();
    var result = H.validateBackup(JSON.stringify(H.createBackup(original, new Date())), '2026-10-28');
    expectEqual(result.ok, true);
    expectEqual(result.summary.kind, 'v2');
    expectSame(result.state, original);
  });

  test('a 1.1 backup file can still be restored, and is upgraded', function () {
    var v1Backup = JSON.stringify(L1.createBackup(copy(V1_FIXTURE), new Date(2026, 9, 20)));
    var result = H.validateBackup(v1Backup, ACTIVATED);
    expectEqual(result.ok, true);
    expectEqual(result.summary.kind, 'v1');
    expectSame(result.state.supplies, V1_FIXTURE.supplies);
    expectSame(result.state.legacy.history, V1_FIXTURE.history);
    expectEqual(result.state.tasks.length, 42);
    expectSame(result.state.records, {});
  });

  test('files that are not backups are rejected', function () {
    ['', '   ', 'hello', '[1,2]', 'null', '{"app":"other","backupVersion":2,"data":{}}'].forEach(function (text) {
      expectEqual(H.validateBackup(text, ACTIVATED).ok, false);
    });
  });

  test('a backup from a newer version is rejected', function () {
    var file = H.createBackup(usedState(), new Date());
    file.backupVersion = 3;
    var result = H.validateBackup(JSON.stringify(file), ACTIVATED);
    expectTrue(!result.ok && result.error.indexOf('newer') > -1, result.error);
  });

  test('damaged 1.2 backups are rejected with a clear message', function () {
    function broken(change) {
      var file = H.createBackup(usedState(), new Date());
      change(file.data);
      return H.validateBackup(JSON.stringify(file), ACTIVATED);
    }
    var cases = [
      [function (d) { d.tasks[0].frequency = 'daily'; }, 'room chores'],
      [function (d) { d.tasks[0].room = 'hallway'; }, 'room chores'],
      [function (d) { d.tasks[1].id = d.tasks[0].id; }, 'room chores'],
      [function (d) { d.tasks[0].since = '2026-10-25'; }, 'room chores'], // not a Saturday
      [function (d) { delete d.records['bathroom-clean-toilet|2026-10-24'].completedOn; }, 'completion records'],
      [function (d) { d.records.wrong = d.records['bathroom-clean-toilet|2026-10-24']; }, 'completion records'],
      [function (d) { d.laundry.loads[2].stage = 'washer'; }, 'laundry'], // two loads in the washer
      [function (d) { d.laundry.loads[0].stage = 'spinning'; }, 'laundry'],
      [function (d) { d.supplies[0].done = 'yes'; }, 'supplies'],
      [function (d) { d.legacy.history = []; }, 'archive'],
      [function (d) { d.activatedWeek = '2026-10-25'; }, 'start date']
    ];
    cases.forEach(function (c, i) {
      var result = broken(c[0]);
      if (result.ok) throw new Error('case ' + i + ' should have been rejected');
      if (result.error.indexOf(c[1]) === -1) throw new Error('case ' + i + ' gave: ' + result.error);
    });
  });

  test('a damaged 1.1 backup is rejected', function () {
    var file = L1.createBackup(copy(V1_FIXTURE), new Date());
    file.data.pets = 'two cats';
    expectEqual(H.validateBackup(JSON.stringify(file), ACTIVATED).ok, false);
  });

  test('a rejected backup leaves saved data unchanged', function () {
    var storage = fakeStorage({});
    H.saveState(storage, usedState());
    var before = storage.data['householdReset.v2'];
    // This is what the app does: save only if the backup passed every check.
    var result = H.validateBackup('{"app":"household-reset","backupVersion":2,"data":{"version":2}}', ACTIVATED);
    if (result.ok) H.saveState(storage, result.state);
    expectEqual(result.ok, false);
    expectEqual(storage.data['householdReset.v2'], before);
  });

  test('restored data passes the same checks when loaded again', function () {
    var result = H.validateBackup(JSON.stringify(H.createBackup(usedState(), new Date())), ACTIVATED);
    var storage = fakeStorage({});
    H.saveState(storage, result.state);
    var loaded = H.loadState(storage, '2026-10-28');
    expectEqual(loaded.source, 'saved');
    expectSame(loaded.state, result.state);
  });

  // ======================================================================
  section('Audit: real-world 1.1 data and older backups');

  // Non-default version 1.1 data: renamed and deleted chores, a one-time
  // chore, custom supplies, renamed cats, and history across New Year.
  var V1_CUSTOM = {
    version: 1,
    chores: [
      { id: 'k8f2a1', name: 'Vacuum upstairs & stairs', recurring: true, doneWeek: '2026-W02' },
      { id: 'k8f2a2', name: 'Mop floors', recurring: true, doneWeek: null },
      { id: 'k8f2a3', name: "Clean Biscuit's water fountain", recurring: true, doneWeek: '2026-W02' },
      { id: 'k8f2a4', name: 'Return library books', recurring: false, doneWeek: null }
    ],
    supplies: [
      { id: 'q1', name: 'Unscented cat litter', done: false },
      { id: 'q2', name: 'Dish soap', done: true },
      { id: 'q3', name: 'Lavender laundry pods', done: true },
      { id: 'q4', name: 'Paper towels', done: false }
    ],
    pets: [
      { id: 'r1', name: 'Feed Biscuit breakfast', doneDay: '2026-01-10' },
      { id: 'r2', name: 'Feed Pepper breakfast', doneDay: null },
      { id: 'r3', name: "Pepper's eye drops", doneDay: '2026-01-10' }
    ],
    history: {
      '2025-W51': { weekStart: '2025-12-15', done: 6, total: 9, completed: ['Mop floors', 'Vacuum upstairs & stairs'] },
      '2025-W52': { weekStart: '2025-12-22', done: 2, total: 9, completed: ['Mop floors'] },
      '2026-W01': { weekStart: '2025-12-29', done: 9, total: 9, completed: ['Mop floors'] },
      '2026-W02': { weekStart: '2026-01-05', done: 2, total: 4, completed: ['Vacuum upstairs & stairs', "Clean Biscuit's water fountain"] }
    }
  };

  // A version 1.2 preview that's already been used: ticks, a skip, a move,
  // an as-needed chore, a custom chore, and laundry in every stage.
  function initializedPreview() {
    var state = freshState();
    S.toggleDone(state, 'bathroom-clean-toilet', '2026-10-24', '2026-10-26');
    S.toggleSkip(state, 'kitchen-take-out-kitchen-trash', '2026-10-24');
    S.moveOccurrence(state, 'bathroom-clean-mirror', '2026-10-24', '2026-10-31', '2026-10-26');
    S.markAsNeededDone(state, 'bedroom-wipe-nightstands', '2026-10-27');
    S.addTask(state, 'living-room', 'Water the plants', 'weekly', null, '2026-10-26');
    var a = W.addLoad(state.laundry, 'regular', null, '2026-10-26');
    var b = W.addLoad(state.laundry, 'bedding', 'Guest bed', '2026-10-26');
    var c = W.addLoad(state.laundry, 'towels', null, '2026-10-26');
    W.addLoad(state.laundry, 'regular', 'Work clothes', '2026-10-26');
    W.moveLoad(state.laundry, a.id, 'wash', 'x'); W.moveLoad(state.laundry, a.id, 'dry', 'x'); W.moveLoad(state.laundry, a.id, 'finish', '2026-10-26');
    W.togglePutAway(state.laundry, a.id, '2026-10-27');
    W.clearPutAway(state.laundry);
    W.moveLoad(state.laundry, b.id, 'wash', 'x'); W.moveLoad(state.laundry, b.id, 'dry', 'x');
    W.moveLoad(state.laundry, c.id, 'wash', 'x');
    return state;
  }

  function v1BackupText(data) {
    return JSON.stringify(L1.createBackup(copy(data), new Date(2026, 0, 11, 9, 0)));
  }

  test('scenario 1: custom 1.1 data upgrades with every chore and week archived', function () {
    var storage = fakeStorage({ 'householdReset.v1': JSON.stringify(V1_CUSTOM) });
    var loaded = H.loadState(storage, ACTIVATED);
    expectEqual(loaded.source, 'migrated');
    expectSame(loaded.state.legacy.chores, V1_CUSTOM.chores);
    expectSame(loaded.state.legacy.history, V1_CUSTOM.history);
    expectSame(loaded.state.supplies, V1_CUSTOM.supplies);
    expectSame(loaded.state.pets, V1_CUSTOM.pets);
  });

  test('scenario 1: new room schedule is active and old chores are not copied in', function () {
    var state = H.loadState(fakeStorage({ 'householdReset.v1': JSON.stringify(V1_CUSTOM) }), ACTIVATED).state;
    expectEqual(state.tasks.length, 42);
    var names = state.tasks.map(function (t) { return t.name; });
    V1_CUSTOM.chores.forEach(function (c) { expectTrue(names.indexOf(c.name) === -1, c.name + ' copied'); });
    expectEqual(S.occurrencesForWeek(state, null, '2026-10-24', ACTIVATED).length > 0, true);
    expectSame(state.records, {});
  });

  test('scenario 1: opening the app five times gives identical data', function () {
    var storage = fakeStorage({ 'householdReset.v1': JSON.stringify(V1_CUSTOM) });
    var first = H.loadState(storage, ACTIVATED);
    H.saveState(storage, first.state);
    var saved = storage.data['householdReset.v2'];
    for (var i = 0; i < 5; i++) {
      var again = H.loadState(storage, S.addDays(ACTIVATED, i * 3));
      expectEqual(again.source, 'saved');
      H.saveState(storage, again.state);
      expectEqual(canon(JSON.parse(storage.data['householdReset.v2'])), canon(JSON.parse(saved)));
    }
    expectEqual(storage.data['householdReset.v1'], JSON.stringify(V1_CUSTOM));
  });

  test('scenario 2: a 1.1 backup keeps existing laundry, ticks, and custom chores', function () {
    var preview = initializedPreview();
    var result = H.validateBackup(v1BackupText(V1_CUSTOM), '2026-10-28', preview);
    expectEqual(result.ok, true);
    expectEqual(result.summary.mode, 'merge');
    expectSame(result.state.laundry, preview.laundry);
    expectSame(result.state.records, preview.records);
    expectSame(result.state.asNeeded, preview.asNeeded);
    expectSame(result.state.tasks, preview.tasks);
    expectEqual(result.state.tasks.length, 43);
    expectEqual(result.state.activatedOn, preview.activatedOn);
    expectEqual(result.state.laundry.loads.length, 3);
    expectEqual(result.state.laundry.archive.length, 1);
  });

  test('scenario 2: Supplies and Cats come from the backup, unchanged', function () {
    var result = H.validateBackup(v1BackupText(V1_CUSTOM), '2026-10-28', initializedPreview());
    expectSame(result.state.supplies, V1_CUSTOM.supplies);
    expectSame(result.state.pets, V1_CUSTOM.pets);
  });

  test('scenario 2: old chores and history are added to the archive', function () {
    var result = H.validateBackup(v1BackupText(V1_CUSTOM), '2026-10-28', initializedPreview());
    expectSame(result.state.legacy.history, V1_CUSTOM.history);
    expectSame(result.state.legacy.chores, V1_CUSTOM.chores);
    expectSame(result.summary.added, { weeks: 4, identicalWeeks: 0, conflictWeeks: [], chores: 4, identicalChores: 0, conflictChores: [] });
  });

  test('scenario 2: restoring the same 1.1 backup twice adds nothing the second time', function () {
    var once = H.validateBackup(v1BackupText(V1_CUSTOM), '2026-10-28', initializedPreview());
    var twice = H.validateBackup(v1BackupText(V1_CUSTOM), '2026-10-29', once.state);
    expectSame(twice.state, once.state);
    expectSame(twice.summary.added, { weeks: 0, identicalWeeks: 4, conflictWeeks: [], chores: 0, identicalChores: 4, conflictChores: [] });
  });

  test('scenario 2: archive entries already there are never deleted or replaced', function () {
    // Upgraded from V1_FIXTURE first, then restore a backup with overlapping weeks.
    var state = H.migrateFromV1(copy(V1_FIXTURE), ACTIVATED).state;
    var older = copy(V1_FIXTURE);
    older.history['2026-W43'] = { weekStart: '2026-10-19', done: 0, total: 5, completed: [] }; // stale copy of a week
    older.history['2026-W40'] = { weekStart: '2026-09-28', done: 5, total: 11, completed: ['Mop floors'] }; // extra week
    older.chores.push({ id: 'other-device', name: 'Vacuum floors', recurring: true, doneWeek: null }); // same chore, other id
    var result = H.validateBackup(v1BackupText(older), '2026-10-28', state);
    expectSame(result.state.legacy.history['2026-W43'], V1_FIXTURE.history['2026-W43']);
    expectEqual(result.state.legacy.history['2026-W40'].done, 5);
    expectEqual(Object.keys(result.state.legacy.history).length, 4);
    expectEqual(result.state.legacy.chores.filter(function (c) { return c.name === 'Vacuum floors'; }).length, 1);
    expectEqual(result.state.legacy.archivedOn, ACTIVATED);
  });

  test('scenario 2: checking a backup never changes the data in use', function () {
    var preview = initializedPreview();
    var before = canon(preview);
    var result = H.validateBackup(v1BackupText(V1_CUSTOM), '2026-10-28', preview);
    result.state.laundry.loads.length = 0;
    result.state.legacy.chores.push({ id: 'x', name: 'x', recurring: true, doneWeek: null });
    expectEqual(canon(preview), before);
  });

  test('scenario 2: the merged data passes every check and reloads the same', function () {
    var result = H.validateBackup(v1BackupText(V1_CUSTOM), '2026-10-28', initializedPreview());
    var storage = fakeStorage({});
    H.saveState(storage, result.state);
    var loaded = H.loadState(storage, '2026-10-29');
    expectEqual(loaded.source, 'saved');
    expectSame(loaded.state, result.state);
  });

  test('a 1.2 backup still replaces everything, including laundry (as its warning says)', function () {
    var backupState = usedState();
    var result = H.validateBackup(JSON.stringify(H.createBackup(backupState, new Date())), '2026-10-28', initializedPreview());
    expectEqual(result.summary.kind, 'v2');
    expectSame(result.state, backupState);
  });

  test('a damaged 1.1 backup is refused and the data in use is untouched', function () {
    var preview = initializedPreview();
    var before = canon(preview);
    var file = L1.createBackup(copy(V1_CUSTOM), new Date());
    file.data.supplies[1].done = 'sometimes';
    var result = H.validateBackup(JSON.stringify(file), '2026-10-28', preview);
    expectEqual(result.ok, false);
    expectEqual(canon(preview), before);
  });

  test('damaged 1.2 data with no 1.1 data is reported, with a safety copy', function () {
    var storage = fakeStorage({ 'householdReset.v2': '{"version":2' });
    var loaded = H.loadState(storage, ACTIVATED);
    expectEqual(loaded.source, 'damaged');
    expectEqual(loaded.canSave, false);
    expectEqual(loaded.damagedCopy, true);
    expectEqual(storage.data['householdReset.v2.damaged'], '{"version":2');
  });

  // ======================================================================
  section('Release review fixes');

  // A pretend storage where reading one key fails, or every write fails.
  function failingStorage(initial, options) {
    var s = fakeStorage(initial);
    var get = s.getItem;
    s.getItem = function (k) {
      if (options.readFails && options.readFails.indexOf(k) > -1) throw new Error('read failed');
      return get(k);
    };
    if (options.writesFail) s.setItem = function () { throw new Error('quota exceeded'); };
    return s;
  }

  // --- 1. Damaged 1.1 data is never replaced without a decision
  test('#1 damaged 1.1 data: nothing is written, and every reload still asks', function () {
    var storage = fakeStorage({ 'householdReset.v1': '{"version":1,"chores":"broken' });
    for (var i = 0; i < 3; i++) {
      var loaded = H.loadState(storage, ACTIVATED);
      expectEqual(loaded.source, 'damaged');
      expectEqual(loaded.needsDecision, true);
      expectEqual(loaded.canSave, false);
    }
    expectEqual(storage.data['householdReset.v2'], undefined);
    expectEqual(storage.data['householdReset.v1'], '{"version":1,"chores":"broken');
  });

  test('#1 damaged 1.2 data with good 1.1 data: offers the 1.1 lists but waits to save', function () {
    var storage = fakeStorage({ 'householdReset.v1': JSON.stringify(V1_FIXTURE), 'householdReset.v2': '{"oops":' });
    var loaded = H.loadState(storage, ACTIVATED);
    expectEqual(loaded.needsDecision, true);
    expectEqual(loaded.problem, false);
    expectSame(loaded.state.supplies, V1_FIXTURE.supplies); // the stand-in is the upgraded 1.1 data
    expectEqual(storage.data['householdReset.v2'], '{"oops":'); // not overwritten
  });

  test('#1 an earlier, different safety copy is never overwritten', function () {
    var storage = fakeStorage({ 'householdReset.v2': '{"second damage"', 'householdReset.v2.damaged': '{"first damage"' });
    H.loadState(storage, ACTIVATED);
    expectEqual(storage.data['householdReset.v2.damaged'], '{"first damage"');
    expectEqual(storage.data['householdReset.v2.damaged.' + ACTIVATED], '{"second damage"');
  });

  test('#1 the raw old data can be downloaded exactly as stored', function () {
    var storage = fakeStorage({ 'householdReset.v1': '{broken', 'someOtherApp': 'x' });
    expectSame(H.rawSavedData(storage), { 'householdReset.v1': '{broken' });
  });

  // --- 2. Read failures are not treated as "no data"
  test('#2 if 1.1 data cannot be read, nothing is created or saved', function () {
    var storage = failingStorage({ 'householdReset.v1': JSON.stringify(V1_FIXTURE) }, { readFails: ['householdReset.v1'] });
    var loaded = H.loadState(storage, ACTIVATED);
    expectEqual(loaded.source, 'unreadable');
    expectEqual(loaded.canSave, false);
    expectEqual(storage.data['householdReset.v2'], undefined);
  });

  test('#2 if 1.2 data cannot be read, saving is switched off', function () {
    var storage = failingStorage({ 'householdReset.v2': '{}' }, { readFails: ['householdReset.v2'] });
    var loaded = H.loadState(storage, ACTIVATED);
    expectEqual(loaded.source, 'unreadable');
    expectEqual(loaded.canSave, false);
  });

  test('#2 if a damaged-data safety copy cannot be written, nothing else happens', function () {
    var storage = failingStorage({ 'householdReset.v2': '{bad', 'householdReset.v1': JSON.stringify(V1_FIXTURE) }, { writesFail: true });
    var loaded = H.loadState(storage, ACTIVATED);
    expectEqual(loaded.source, 'unreadable');
    expectEqual(loaded.canSave, false);
    expectEqual(storage.data['householdReset.v2'], '{bad');
  });

  // --- 3. Conflicting archive records are detected and reported
  test('#3 a week that differs in the backup is reported as a conflict and the archived one is kept', function () {
    var state = H.migrateFromV1(copy(V1_FIXTURE), ACTIVATED).state;
    var older = copy(V1_FIXTURE);
    older.history['2026-W42'].done = 3; // different from the archive
    older.history['2026-W40'] = { weekStart: '2026-09-28', done: 5, total: 11, completed: [] }; // new
    var result = H.validateBackup(v1BackupText(older), '2026-10-28', state);
    expectSame(result.summary.added.conflictWeeks, [{ week: '2026-W42', weekStart: '2026-10-12' }]);
    expectEqual(result.summary.added.identicalWeeks, 2); // W41 and W43 match exactly
    expectEqual(result.summary.added.weeks, 1);
    expectSame(result.state.legacy.history['2026-W42'], V1_FIXTURE.history['2026-W42']);
  });

  test('#3 a renamed chore with the same id is a conflict; the archived name is kept', function () {
    var state = H.migrateFromV1(copy(V1_FIXTURE), ACTIVATED).state;
    var older = copy(V1_FIXTURE);
    older.chores[0].name = 'Vacuum everywhere';
    var result = H.validateBackup(v1BackupText(older), '2026-10-28', state);
    expectSame(result.summary.added.conflictChores, [{ id: 'c1', archivedName: 'Vacuum floors', backupName: 'Vacuum everywhere' }]);
    expectEqual(result.state.legacy.chores.filter(function (c) { return c.id === 'c1'; })[0].name, 'Vacuum floors');
    expectEqual(result.state.legacy.chores.length, V1_FIXTURE.chores.length);
  });

  test('#3 key order alone is not a conflict', function () {
    var state = H.migrateFromV1(copy(V1_FIXTURE), ACTIVATED).state;
    var reordered = copy(V1_FIXTURE);
    var w = reordered.history['2026-W41'];
    reordered.history['2026-W41'] = { completed: w.completed, total: w.total, done: w.done, weekStart: w.weekStart };
    var result = H.validateBackup(v1BackupText(reordered), '2026-10-28', state);
    expectEqual(result.summary.added.conflictWeeks.length, 0);
    expectEqual(result.summary.added.identicalWeeks, 3);
  });

  // --- 4. Restores only count as done when saved
  test('#4 a failed save leaves the saved data exactly as it was', function () {
    var storage = fakeStorage({});
    var original = initializedPreview();
    H.saveState(storage, original);
    var before = storage.data['householdReset.v2'];
    var full = failingStorage(storage.data, { writesFail: true });
    var result = H.validateBackup(v1BackupText(V1_CUSTOM), '2026-10-28', original);
    expectEqual(result.ok, true);
    expectEqual(H.saveState(full, result.state), false);
    expectEqual(full.data['householdReset.v2'], before);
  });

  // --- 5. Valid migrations stay idempotent and protected
  test('#5 valid 1.1 data: load, save, and reload ten times gives identical data', function () {
    var storage = fakeStorage({ 'householdReset.v1': JSON.stringify(V1_CUSTOM) });
    var first = H.loadState(storage, ACTIVATED);
    expectEqual(first.source, 'migrated');
    H.saveState(storage, first.state);
    var saved = canon(JSON.parse(storage.data['householdReset.v2']));
    for (var i = 0; i < 10; i++) {
      var again = H.loadState(storage, ACTIVATED);
      H.saveState(storage, again.state);
    }
    expectEqual(canon(JSON.parse(storage.data['householdReset.v2'])), saved);
    expectEqual(JSON.parse(storage.data['householdReset.v2']).tasks.length, 42);
  });

  test('#5 a 1.1 backup changes only Supplies, Cats, and the archive', function () {
    var preview = initializedPreview();
    var result = H.validateBackup(v1BackupText(V1_CUSTOM), '2026-10-28', preview);
    ['version', 'activatedOn', 'activatedWeek', 'tasks', 'records', 'asNeeded', 'laundry'].forEach(function (key) {
      expectSame(result.state[key], preview[key]);
    });
  });

  // --- 7 and 8. Year boundaries and week navigation
  // Version 1.2 activated just before New Year: Saturday 19 Dec 2026.
  function newYearState() {
    return H.createState('2026-12-19', null);
  }

  function overdueWeeks(state, taskId, today) {
    return S.overdueOccurrences(state, null, today)
      .filter(function (o) { return o.task.id === taskId; })
      .map(function (o) { return o.week; });
  }

  test('#8 weekly, biweekly, monthly, and quarterly overdue across New Year', function () {
    var state = newYearState();
    var today = '2027-01-11'; // week of Sat 9 Jan 2027
    expectEqual(overdueWeeks(state, 'bathroom-clean-toilet', today), ['2026-12-19', '2026-12-26', '2027-01-02']);
    expectEqual(overdueWeeks(state, 'bathroom-clean-mirror', today), ['2026-12-19', '2027-01-02']);
    expectEqual(overdueWeeks(state, 'bathroom-deep-clean-shower-tub', today), ['2027-01-02']);
    expectEqual(overdueWeeks(state, 'kitchen-clean-oven', today), ['2027-01-02']);
    expectEqual(overdueWeeks(state, 'kitchen-organize-pantry', today), []);
  });

  test('#8 skipping and late completion across New Year', function () {
    var state = newYearState();
    S.toggleSkip(state, 'bathroom-clean-toilet', '2026-12-26');
    S.toggleDone(state, 'bathroom-clean-toilet', '2026-12-19', '2027-01-11');
    expectEqual(overdueWeeks(state, 'bathroom-clean-toilet', '2027-01-11'), ['2027-01-02']);
    var dec19 = S.weekHistory(state, '2026-12-19', '2027-01-11');
    var toilet = dec19.done.filter(function (o) { return o.task.id === 'bathroom-clean-toilet'; })[0];
    expectEqual(toilet.record.completedOn, '2027-01-11');
    expectEqual(S.weekHistory(state, '2026-12-26', '2027-01-11').skipped.length, 1);
  });

  test('#8 a chore moved from December into January keeps its December due week', function () {
    var state = newYearState();
    expectEqual(S.moveOccurrence(state, 'bathroom-clean-toilet', '2026-12-26', '2027-01-16', '2027-01-11'), true);
    expectEqual(overdueWeeks(state, 'bathroom-clean-toilet', '2027-01-11').indexOf('2026-12-26'), -1);
    var jan16 = S.occurrencesForWeek(state, 'bathroom', '2027-01-16', '2027-01-11')
      .filter(function (o) { return o.task.id === 'bathroom-clean-toilet' && o.week === '2026-12-26'; });
    expectEqual(jan16.length, 1);
    expectEqual(S.occurrencesForWeek(state, 'bathroom', '2027-01-16', '2027-01-18').filter(function (o) { return o.week === '2026-12-26' && o.task.id === 'bathroom-clean-toilet'; })[0].status, 'due'); // due during its new week
    expectEqual(overdueWeeks(state, 'bathroom-clean-toilet', '2027-01-25').indexOf('2026-12-26') > -1, true); // overdue once that week ends
  });

  test('#8 New Year 2028 starts on a Saturday: monthly and quarterly chores are due that week', function () {
    expectEqual(S.weekStart('2028-01-01'), '2028-01-01');
    expectEqual(S.weekStart('2027-12-31'), '2027-12-25');
    expectEqual(S.isDueInWeek({ frequency: 'monthly' }, '2028-01-01'), true);
    expectEqual(S.isDueInWeek({ frequency: 'quarterly' }, '2028-01-01'), true);
    expectEqual(S.isDueInWeek({ frequency: 'biweekly', anchor: '2026-10-24' }, '2028-01-01'), S.weeksBetween('2026-10-24', '2028-01-01') % 2 === 0);
  });

  test('#7 viewing weeks across New Year never changes completion records', function () {
    var state = newYearState();
    S.toggleDone(state, 'bathroom-clean-toilet', '2026-12-19', '2026-12-20');
    S.toggleSkip(state, 'kitchen-clean-kitchen-sink', '2026-12-26');
    S.moveOccurrence(state, 'bathroom-clean-mirror', '2027-01-02', '2027-01-16', '2027-01-04');
    var before = canon(state);
    for (var w = '2026-11-28'; w <= '2027-02-27'; w = S.addWeeks(w, 1)) {
      S.overview(state, w, '2027-01-11');
      S.weekHistory(state, w, '2027-01-11');
      S.ROOMS.forEach(function (room) { S.occurrencesForWeek(state, room.id, w, '2027-01-11'); });
    }
    expectEqual(canon(state), before);
  });

  // --- 9 and 10. Laundry
  function finish(laundry, id, day) {
    W.moveLoad(laundry, id, 'wash', day); W.moveLoad(laundry, id, 'dry', day); W.moveLoad(laundry, id, 'finish', day);
  }

  test('#9 board counters describe the board; the week total includes cleared loads', function () {
    var laundry = W.createLaundry();
    var a = W.addLoad(laundry, 'regular', null, '2026-10-26');
    finish(laundry, a.id, '2026-10-26');
    W.togglePutAway(laundry, a.id, '2026-10-26');
    expectEqual(W.counts(laundry).finished, 1);
    expectEqual(W.finishedBetween(laundry, '2026-10-24', '2026-10-30'), 1);
    W.clearPutAway(laundry);
    expectEqual(W.counts(laundry).finished, 0); // off the board…
    expectEqual(W.finishedBetween(laundry, '2026-10-24', '2026-10-30'), 1); // …but still counted for the week
    expectEqual(W.finishedBetween(laundry, '2026-10-31', '2026-11-06'), 0);
  });

  test('#10 load names are not reused after loads are cleared', function () {
    var laundry = W.createLaundry();
    var a = W.addLoad(laundry, 'regular', null, '2026-10-26');
    finish(laundry, a.id, '2026-10-26');
    W.togglePutAway(laundry, a.id, '2026-10-26');
    W.clearPutAway(laundry);
    expectEqual(W.addLoad(laundry, 'regular', null, '2026-10-27').name, 'Regular clothes 2');
  });

  test('#10 deleting the load in the washer frees the washer', function () {
    var laundry = W.createLaundry();
    var a = W.addLoad(laundry, 'regular', null, 'd');
    var b = W.addLoad(laundry, 'bedding', null, 'd');
    W.moveLoad(laundry, a.id, 'wash', 'd');
    expectEqual(W.canMove(laundry, b, 'wash').ok, false);
    W.deleteLoad(laundry, a.id);
    expectEqual(W.canMove(laundry, b, 'wash').ok, true);
  });

  test('#10 undo, extra drying, and put-away stay consistent', function () {
    var laundry = W.createLaundry();
    var a = W.addLoad(laundry, 'towels', null, 'd');
    finish(laundry, a.id, '2026-10-26');
    W.togglePutAway(laundry, a.id, '2026-10-27');
    W.moveLoad(laundry, a.id, 'dryAgain', 'd'); // still damp: back in the dryer
    expectEqual(a.stage, 'dryer');
    expectEqual(a.putAway, false);
    expectEqual(a.putAwayOn, null);
    expectEqual(a.dryCycles, 2);
    W.moveLoad(laundry, a.id, 'back', 'd'); // dryer -> washer resets drying
    expectEqual(a.dryCycles, 0);
    expectEqual(W.togglePutAway(laundry, a.id, 'd'), false); // can't put away a load in the washer
  });

  test('#10 the laundry archive survives backup, restore, and reload', function () {
    var state = freshState();
    var a = W.addLoad(state.laundry, 'regular', null, '2026-10-26');
    finish(state.laundry, a.id, '2026-10-26');
    W.togglePutAway(state.laundry, a.id, '2026-10-26');
    W.clearPutAway(state.laundry);
    var result = H.validateBackup(JSON.stringify(H.createBackup(state, new Date())), '2026-10-28');
    expectSame(result.state.laundry.archive, state.laundry.archive);
    var storage = fakeStorage({});
    H.saveState(storage, result.state);
    expectSame(H.loadState(storage, '2026-10-29').state.laundry.archive, state.laundry.archive);
  });

  // ======================================================================
  section('Heads up panel');

  var P = window.HouseholdPrep;

  function kinds(hu) {
    return hu.groups.map(function (g) { return g.kind; });
  }

  test('current week: overdue first, then next week\'s monthly chores', function () {
    var hu = S.headsUp(freshState(), '2026-10-31', '2026-11-02');
    expectEqual(hu.relation, 'current');
    expectEqual(kinds(hu), ['overdue', 'soon']);
    expectEqual(hu.groups[0].items.length, 25); // 16 weekly + 9 every-2-weeks chores missed in the week of Oct 24
    expectEqual(hu.groups[1].week, '2026-11-07');
    expectEqual(hu.groups[1].items.length, 8); // the monthly chores
  });

  test('due group lists only less-frequent chores, never ordinary weekly ones', function () {
    var hu = S.headsUp(freshState(), '2026-10-24', ACTIVATED);
    expectEqual(kinds(hu), ['due']);
    expectTrue(hu.groups[0].items.every(function (i) { return i.task.frequency === 'biweekly'; }), 'only every-2-weeks chores due');
    expectEqual(hu.groups[0].items.length, 9);
  });

  test('a future week shows chores due in THAT week, and no overdue group', function () {
    var hu = S.headsUp(freshState(), '2026-11-07', '2026-11-02');
    expectEqual(hu.relation, 'future');
    expectEqual(kinds(hu), ['due']);
    expectEqual(hu.groups[0].items.length, 17); // 9 every-2-weeks + 8 monthly
  });

  test('a past week shows only that week\'s chores that are still overdue', function () {
    var state = freshState();
    S.toggleDone(state, 'bathroom-clean-toilet', '2026-10-24', '2026-10-26');
    var hu = S.headsUp(state, '2026-10-24', '2026-11-02');
    expectEqual(hu.relation, 'past');
    expectEqual(kinds(hu), ['overdue']);
    expectEqual(hu.groups[0].items.length, 24); // 25 due, 1 done
    expectTrue(hu.groups[0].items.every(function (i) { return i.effectiveWeek === '2026-10-24'; }), 'all from that week');
  });

  test('never more than three groups, always in priority order', function () {
    var state = freshState();
    var order = { overdue: 0, due: 1, soon: 2 };
    for (var w = '2026-10-24'; w <= '2027-02-27'; w = S.addWeeks(w, 1)) {
      var hu = S.headsUp(state, w, '2026-11-30');
      expectTrue(hu.groups.length <= 3, w);
      for (var i = 1; i < hu.groups.length; i++) expectTrue(order[hu.groups[i - 1].kind] < order[hu.groups[i].kind], w + ' order');
    }
  });

  test('every chore listed belongs to the week its group names', function () {
    var state = freshState();
    S.moveOccurrence(state, 'bathroom-clean-mirror', '2026-10-24', '2026-11-14', '2026-10-26');
    S.toggleDone(state, 'kitchen-clean-oven', '2027-01-02', '2026-10-26'); // done early
    for (var w = '2026-10-24'; w <= '2027-03-27'; w = S.addWeeks(w, 1)) {
      var hu = S.headsUp(state, w, '2026-10-26');
      hu.groups.forEach(function (g) {
        g.items.forEach(function (item) {
          if (g.kind === 'due') expectEqual(item.effectiveWeek, w);
          if (g.kind === 'soon') expectEqual(item.effectiveWeek, S.addWeeks(w, 1));
          if (g.kind !== 'overdue') expectTrue(item.task.frequency !== 'weekly', 'weekly listed in ' + g.kind);
          expectTrue(!(item.task.id === 'kitchen-clean-oven' && item.week === '2027-01-02'), 'done chore listed');
        });
      });
    }
    var nov14 = S.headsUp(state, '2026-11-14', '2026-10-26').groups[0].items;
    expectTrue(nov14.some(function (i) { return i.task.id === 'bathroom-clean-mirror' && i.week === '2026-10-24'; }), 'moved chore in its new week');
  });

  test('all clear when nothing needs attention', function () {
    var state = freshState();
    state.tasks = state.tasks.filter(function (t) { return t.frequency === 'weekly'; });
    expectEqual(S.headsUp(state, '2026-10-24', ACTIVATED).groups.length, 0);
    expectEqual(S.headsUp(state, '2026-10-17', ACTIVATED).beforeActivation, true);
  });

  test('heads up and the overview never change saved data', function () {
    var state = usedState();
    var before = canon(state);
    for (var w = '2026-10-17'; w <= '2027-01-30'; w = S.addWeeks(w, 1)) {
      S.headsUp(state, w, '2026-11-16');
      S.overview(state, w, '2026-11-16');
    }
    expectEqual(canon(state), before);
  });

  test('overview "Next week" counts less-frequent chores due the week after', function () {
    expectEqual(S.overview(freshState(), '2026-10-31', '2026-11-02').nextWeek, 17);
    expectEqual(S.overview(freshState(), '2026-10-24', ACTIVATED).nextWeek, 0);
  });

  // ======================================================================
  section('Get ready for next week');

  function promptFor(state, today, taskId) {
    return P.prompts(state, today).filter(function (p) { return p.task.id === taskId; })[0];
  }

  test('next week is the following Saturday–Friday, including across New Year', function () {
    expectEqual(P.nextWeek('2026-10-30'), '2026-10-31'); // Friday
    expectEqual(P.nextWeek('2026-10-31'), '2026-11-07'); // Saturday starts a new week
    expectEqual(P.nextWeek('2026-11-01'), '2026-11-07'); // Sunday
    expectEqual(P.nextWeek('2026-12-31'), '2027-01-02');
    expectEqual(P.nextWeek('2027-01-01'), '2027-01-02');
  });

  test('only next week\'s chores that need supplies get a prompt', function () {
    var ids = P.prompts(freshState(), '2026-11-02').map(function (p) { return p.task.id; }).sort();
    expectEqual(ids, ['bathroom-change-bathroom-trash', 'bathroom-clean-mirror', 'bathroom-deep-clean-shower-tub',
      'bedroom-change-bedroom-trash', 'bedroom-clean-bedroom-mirror', 'whole-house-change-scent-booster-plugins']);
    expectEqual(P.prompts(freshState(), '2026-10-28').length, 0); // next week (Oct 31) has no such chores
  });

  test('scent plugins due next week asks about scent plugin refills', function () {
    var prompt = promptFor(freshState(), '2026-11-02', 'whole-house-change-scent-booster-plugins');
    expectEqual(prompt.week, '2026-11-07');
    expectSame(prompt.supplies.map(function (s) { return [s.name, s.status]; }), [['Scent plugin refills', 'missing']]);
    expectEqual(P.addAction(prompt), 'add');
  });

  test('no generic prompts: weekly chores and chores without supplies never ask', function () {
    var state = freshState();
    Object.keys(S.DEFAULT_TASK_SUPPLIES).forEach(function (id) {
      var task = S.findTask(state, id);
      expectTrue(task && task.frequency !== 'weekly', id);
    });
    expectEqual(S.findTask(state, 'bathroom-wash-shower-curtains').supplies, undefined);
    for (var day = '2026-10-25'; day < '2027-03-01'; day = S.addDays(day, 7)) {
      P.prompts(state, day).forEach(function (p) {
        expectTrue(p.task.supplies.length > 0 && p.task.frequency !== 'weekly', p.task.name);
      });
    }
  });

  test('a ticked item on the Supplies list still asks (never assumed in stock)', function () {
    var state = freshState();
    state.supplies.push({ id: 'g1', name: 'Glass cleaner', done: true });
    var prompt = promptFor(state, '2026-11-02', 'bathroom-clean-mirror');
    expectEqual(prompt.answer, null);
    expectEqual(prompt.supplies[0].status, 'ticked');
    expectEqual(P.addAction(prompt), 'mark');
  });

  test('"Add to supplies" adds a missing item once, as needed (unticked)', function () {
    var state = freshState();
    var before = state.supplies.length;
    P.addToSupplies(state, promptFor(state, '2026-11-02', 'whole-house-change-scent-booster-plugins'), '2026-11-02');
    expectEqual(state.supplies.length, before + 1);
    var item = P.findSupply(state, 'scent plugin refills');
    expectEqual(item.done, false);
    expectEqual(state.prep['whole-house-change-scent-booster-plugins|2026-11-07'].answer, 'added');
  });

  test('no duplicates: an existing item is marked as needed instead (ignoring capitals)', function () {
    var state = freshState();
    state.supplies.push({ id: 'g1', name: 'glass  CLEANER', done: true });
    var count = state.supplies.length;
    P.addToSupplies(state, promptFor(state, '2026-11-02', 'bathroom-clean-mirror'), '2026-11-02');
    P.addToSupplies(state, promptFor(state, '2026-11-02', 'bedroom-clean-bedroom-mirror'), '2026-11-02');
    expectEqual(state.supplies.length, count);
    expectEqual(state.supplies.filter(function (s) { return /glass/i.test(s.name); }).length, 1);
    expectEqual(P.findSupply(state, 'Glass cleaner').done, false);
  });

  test('two chores needing the same new item add it only once', function () {
    var state = freshState();
    P.addToSupplies(state, promptFor(state, '2026-11-02', 'bathroom-change-bathroom-trash'), '2026-11-02');
    var second = promptFor(state, '2026-11-02', 'bedroom-change-bedroom-trash');
    expectEqual(P.addAction(second), 'mark');
    P.addToSupplies(state, second, '2026-11-02');
    expectEqual(state.supplies.filter(function (s) { return s.name === 'Small trash bags'; }).length, 1);
  });

  test('"I\'m stocked" is saved for that occurrence and survives a reload', function () {
    var state = freshState();
    P.answerStocked(state, promptFor(state, '2026-11-02', 'whole-house-change-scent-booster-plugins'), '2026-11-02');
    var storage = fakeStorage({});
    H.saveState(storage, state);
    var loaded = H.loadState(storage, '2026-11-03').state;
    expectEqual(promptFor(loaded, '2026-11-03', 'whole-house-change-scent-booster-plugins').answer.answer, 'stocked');
    expectEqual(P.answerStocked(loaded, promptFor(loaded, '2026-11-03', 'whole-house-change-scent-booster-plugins'), '2026-11-03'), false);
  });

  test('the next occurrence of the same chore asks again', function () {
    var state = freshState();
    P.answerStocked(state, promptFor(state, '2026-11-02', 'whole-house-change-scent-booster-plugins'), '2026-11-02');
    var december = promptFor(state, '2026-11-30', 'whole-house-change-scent-booster-plugins');
    expectEqual(december.week, '2026-12-05');
    expectEqual(december.answer, null);
  });

  test('undo removes an added item, or restores an item\'s old tick', function () {
    var state = freshState();
    var supplyCount = state.supplies.length;
    P.addToSupplies(state, promptFor(state, '2026-11-02', 'whole-house-change-scent-booster-plugins'), '2026-11-02');
    P.undoAnswer(state, 'whole-house-change-scent-booster-plugins|2026-11-07');
    expectEqual(state.supplies.length, supplyCount);
    expectEqual(promptFor(state, '2026-11-02', 'whole-house-change-scent-booster-plugins').answer, null);

    state.supplies.push({ id: 'g1', name: 'Glass cleaner', done: true });
    P.addToSupplies(state, promptFor(state, '2026-11-02', 'bathroom-clean-mirror'), '2026-11-02');
    expectEqual(P.findSupply(state, 'Glass cleaner').done, false);
    P.undoAnswer(state, 'bathroom-clean-mirror|2026-11-07');
    expectEqual(P.findSupply(state, 'Glass cleaner').done, true);
  });

  test('undo keeps an added item that another answer still relies on', function () {
    var state = freshState();
    P.addToSupplies(state, promptFor(state, '2026-11-02', 'bathroom-clean-mirror'), '2026-11-02'); // adds it
    P.addToSupplies(state, promptFor(state, '2026-11-02', 'bedroom-clean-bedroom-mirror'), '2026-11-02'); // marks it
    P.undoAnswer(state, 'bathroom-clean-mirror|2026-11-07');
    expectTrue(P.findSupply(state, 'Glass cleaner') !== null, 'still on the Supplies list');
    expectEqual(P.findSupply(state, 'Glass cleaner').done, false);
    P.undoAnswer(state, 'bedroom-clean-bedroom-mirror|2026-11-07');
    expectEqual(P.findSupply(state, 'Glass cleaner').done, false); // its old state when the bedroom answer was given
  });

  test('chores needing the same supplies share one question; answers stay per occurrence', function () {
    var state = freshState();
    var groups = P.groupPrompts(P.prompts(state, '2026-11-02'));
    expectEqual(groups.length, 4); // glass cleaner, small trash bags, tub & tile cleaner, scent refills
    var glass = groups.filter(function (g) { return g.supplies[0].name === 'Glass cleaner'; })[0];
    expectEqual(glass.prompts.map(function (p) { return p.task.id; }).sort(), ['bathroom-clean-mirror', 'bedroom-clean-bedroom-mirror']);
    glass.pending.forEach(function (p) { P.addToSupplies(state, p, '2026-11-02'); });
    expectEqual(state.supplies.filter(function (s) { return s.name === 'Glass cleaner'; }).length, 1);
    expectEqual(Object.keys(state.prep).sort(), ['bathroom-clean-mirror|2026-11-07', 'bedroom-clean-bedroom-mirror|2026-11-07']);
    var after = P.groupPrompts(P.prompts(state, '2026-11-02')).filter(function (g) { return g.key === glass.key; })[0];
    expectEqual(after.pending.length, 0);
    after.prompts.slice().reverse().forEach(function (p) { P.undoAnswer(state, p.key); });
    expectEqual(P.findSupply(state, 'Glass cleaner'), null); // undoing the whole question removes what it added
    expectSame(state.prep, {});
  });

  test('answering prep questions never ticks off chores', function () {
    var state = freshState();
    P.prompts(state, '2026-11-02').forEach(function (p) { P.answerStocked(state, p, '2026-11-02'); });
    expectSame(state.records, {});
  });

  test('chores can list supplies when added or edited', function () {
    var state = freshState();
    var task = S.addTask(state, 'kitchen', 'Descale kettle', 'monthly', null, ACTIVATED, 'Descaler,  descaler , ');
    expectEqual(task.supplies, ['Descaler']);
    S.editTask(state, task.id, 'Descale kettle', 'monthly', null, ACTIVATED); // supplies not given: kept
    expectEqual(S.findTask(state, task.id).supplies, ['Descaler']);
    S.editTask(state, task.id, 'Descale kettle', 'monthly', null, ACTIVATED, '');
    expectEqual(S.findTask(state, task.id).supplies, []); // cleared on purpose: kept as an empty list
  });

  test('prep answers and chore supplies are included in a 1.2 backup', function () {
    var state = usedState();
    P.addToSupplies(state, promptFor(state, '2026-11-02', 'whole-house-change-scent-booster-plugins'), '2026-11-02');
    P.answerStocked(state, promptFor(state, '2026-11-02', 'bathroom-clean-mirror'), '2026-11-02');
    var result = H.validateBackup(JSON.stringify(H.createBackup(state, new Date())), '2026-11-03');
    expectEqual(result.ok, true);
    expectSame(result.state, state);
    expectEqual(Object.keys(result.state.prep).length, 2);
  });

  test('older 1.2 data without prep answers or chore supplies still loads', function () {
    var old = freshState();
    delete old.prep;
    old.tasks.forEach(function (t) { delete t.supplies; });
    var checked = H.validateState(copy(old));
    expectEqual(checked.ok, true);
    expectSame(checked.state.prep, {});
    var restored = H.validateBackup(JSON.stringify({ app: 'household-reset', backupVersion: 2, exportedAt: 'x', data: old }), ACTIVATED);
    expectEqual(restored.ok, true);
  });

  test('damaged prep answers or supplies are rejected', function () {
    var a = freshState();
    a.prep = { 'x|2026-11-07': { answer: 'maybe', answeredOn: '2026-11-02', added: [], marked: [] } };
    expectTrue(H.validateState(copy(a)).error.indexOf('prep') > -1, 'bad answer');
    var b = freshState();
    b.tasks[0].supplies = 'Glass cleaner';
    expectTrue(H.validateState(copy(b)).error.indexOf('room chores') > -1, 'bad supplies');
  });

  test('upgrading from 1.1 adds chore supplies but changes nothing on the Supplies list', function () {
    var state = H.migrateFromV1(copy(V1_FIXTURE), ACTIVATED).state;
    expectEqual(S.findTask(state, 'whole-house-change-scent-booster-plugins').supplies, ['Scent plugin refills']);
    expectSame(state.supplies, V1_FIXTURE.supplies);
    expectSame(state.prep, {});
  });

  test('restoring a 1.1 backup keeps existing prep answers', function () {
    var preview = initializedPreview();
    P.answerStocked(preview, promptFor(preview, '2026-11-02', 'bathroom-clean-mirror'), '2026-11-02');
    var result = H.validateBackup(v1BackupText(V1_CUSTOM), '2026-11-03', preview);
    expectSame(result.state.prep, preview.prep);
  });

  // ======================================================================
  section('Final QC: overdue carryover');

  var R = window.HouseholdReview;
  var MIRROR = 'bathroom-clean-mirror';

  function weeksOf(list, taskId) {
    return list.filter(function (o) { return o.task.id === taskId; }).map(function (o) { return o.week; });
  }

  test('the mirror example: overdue from Oct 24 during Oct 31–Nov 6, Nov 7 still scheduled', function () {
    var state = freshState();
    expectEqual(weeksOf(S.overdueOccurrences(state, 'bathroom', '2026-11-02'), MIRROR), ['2026-10-24']);
    var nov7 = S.occurrencesForWeek(state, 'bathroom', '2026-11-07', '2026-11-02').filter(function (o) { return o.task.id === MIRROR; });
    expectEqual(nov7.length, 1);
    expectEqual(nov7[0].week, '2026-11-07');
  });

  test('finishing the overdue occurrence records the real date and leaves Nov 7 open', function () {
    var state = freshState();
    S.toggleDone(state, MIRROR, '2026-10-24', '2026-11-03');
    expectEqual(S.getRecord(state, MIRROR, '2026-10-24').completedOn, '2026-11-03');
    expectEqual(weeksOf(S.overdueOccurrences(state, 'bathroom', '2026-11-03'), MIRROR), []);
    var nov7 = S.occurrencesForWeek(state, 'bathroom', '2026-11-07', '2026-11-03').filter(function (o) { return o.task.id === MIRROR; })[0];
    expectEqual(nov7.status, 'upcoming');
    expectEqual(S.getRecord(state, MIRROR, '2026-11-07'), null);
  });

  test('browsing a future week shows still-open chores without making them overdue', function () {
    var state = freshState();
    var before = canon(state);
    var preview = S.openBefore(state, 'bathroom', '2026-10-31', ACTIVATED);
    var mirror = preview.filter(function (o) { return o.task.id === MIRROR; })[0];
    expectEqual(mirror.week, '2026-10-24');
    expectEqual(mirror.status, 'due'); // not overdue yet
    expectEqual(weeksOf(S.openBefore(state, 'bathroom', '2026-11-07', ACTIVATED), MIRROR), ['2026-10-24']);
    expectEqual(S.overdueOccurrences(state, null, ACTIVATED).length, 0);
    expectEqual(S.openBefore(state, 'bathroom', '2026-10-24', ACTIVATED).length, 0); // today's week: nothing to preview
    expectEqual(canon(state), before);
  });

  test('weekly, biweekly, monthly, and quarterly chores each carry over once', function () {
    var state = H.createState('2026-10-03', null); // activated in a first-Saturday week
    var overdue = S.overdueOccurrences(state, null, '2026-10-12');
    expectEqual(weeksOf(overdue, 'bathroom-clean-toilet'), ['2026-10-03']);
    expectEqual(weeksOf(overdue, MIRROR), []); // its first due week is Oct 10 (this week)
    expectEqual(weeksOf(overdue, 'bathroom-deep-clean-shower-tub'), ['2026-10-03']);
    expectEqual(weeksOf(overdue, 'kitchen-clean-oven'), ['2026-10-03']);
    var later = S.overdueOccurrences(state, null, '2026-10-19');
    expectEqual(weeksOf(later, MIRROR), ['2026-10-10']);
    expectEqual(weeksOf(later, 'bathroom-deep-clean-shower-tub'), ['2026-10-03']);
    expectEqual(S.isDueInWeek(S.findTask(state, 'bathroom-deep-clean-shower-tub'), '2026-11-07'), true); // rotation unchanged
  });

  test('carried-over lists never contain duplicates', function () {
    var state = freshState();
    S.moveOccurrence(state, MIRROR, '2026-10-24', '2026-10-31', '2026-10-26');
    [['2026-11-02', null], ['2026-11-16', null]].forEach(function (c) {
      var keys = S.overdueOccurrences(state, c[1], c[0]).map(function (o) { return o.task.id + '|' + o.week; });
      expectEqual(keys.length, keys.filter(function (k, i) { return keys.indexOf(k) === i; }).length);
    });
    var preview = S.openBefore(state, null, '2026-11-14', '2026-11-02').map(function (o) { return o.task.id + '|' + o.week; });
    expectEqual(preview.length, preview.filter(function (k, i) { return preview.indexOf(k) === i; }).length);
  });

  test('short week labels work across months and years', function () {
    expectEqual(S.formatRangeShort('2026-10-24'), 'Oct 24–30');
    expectEqual(S.formatRangeShort('2026-10-31'), 'Oct 31–Nov 6');
    expectEqual(S.formatRangeShort('2026-12-26'), 'Dec 26–Jan 1');
  });

  // ======================================================================
  section('Final QC: occurrence notes');

  test('a note is saved on the occurrence, not the chore', function () {
    var state = freshState();
    S.setNote(state, 'bathroom-change-bathroom-trash', '2026-10-24', '  I didn\'t   have trash bags ');
    expectEqual(S.getRecord(state, 'bathroom-change-bathroom-trash', '2026-10-24').note, 'I didn\'t have trash bags');
    expectEqual(S.findTask(state, 'bathroom-change-bathroom-trash').note, undefined);
    expectEqual(S.getRecord(state, 'bathroom-change-bathroom-trash', '2026-11-07'), null);
  });

  test('the note shows in Heads up overdue details', function () {
    var state = freshState();
    S.setNote(state, 'bathroom-change-bathroom-trash', '2026-10-24', 'No bags');
    var overdue = S.headsUp(state, '2026-10-31', '2026-11-02').groups[0];
    var item = overdue.items.filter(function (i) { return i.task.id === 'bathroom-change-bathroom-trash'; })[0];
    expectEqual(item.note, 'No bags');
  });

  test('the note stays in History after the chore is finished', function () {
    var state = freshState();
    S.setNote(state, 'bathroom-change-bathroom-trash', '2026-10-24', 'No bags');
    S.toggleDone(state, 'bathroom-change-bathroom-trash', '2026-10-24', '2026-11-03');
    var done = S.weekHistory(state, '2026-10-24', '2026-11-03').done.filter(function (o) { return o.task.id === 'bathroom-change-bathroom-trash'; })[0];
    expectEqual(done.record.note, 'No bags');
    expectEqual(done.record.completedOn, '2026-11-03');
  });

  test('notes can be edited and cleared without changing completion', function () {
    var state = freshState();
    S.setNote(state, MIRROR, '2026-10-24', 'First');
    S.setNote(state, MIRROR, '2026-10-24', 'Second');
    expectEqual(S.getRecord(state, MIRROR, '2026-10-24').note, 'Second');
    S.setNote(state, MIRROR, '2026-10-24', '');
    expectEqual(S.getRecord(state, MIRROR, '2026-10-24'), null); // nothing left to keep
    S.toggleDone(state, MIRROR, '2026-10-24', '2026-10-26');
    S.setNote(state, MIRROR, '2026-10-24', 'x');
    S.setNote(state, MIRROR, '2026-10-24', '');
    expectEqual(S.getRecord(state, MIRROR, '2026-10-24').status, 'done');
  });

  // ======================================================================
  section('Final QC: Finish Cleaning Week');

  function reviewState() {
    var state = freshState();
    S.toggleDone(state, 'bathroom-clean-toilet', '2026-10-24', '2026-10-26'); // ticked normally
    return state;
  }

  function draftWith(state, week, today, choices) {
    var draft = R.createDraft(state, week, today);
    Object.keys(choices).forEach(function (key) {
      Object.keys(choices[key]).forEach(function (field) { draft.items[key][field] = choices[key][field]; });
    });
    return draft;
  }

  test('available for this week and past weeks, not future weeks', function () {
    var state = freshState();
    expectEqual(R.canReview(state, '2026-10-24', ACTIVATED), true);
    expectEqual(R.canReview(state, '2026-10-24', '2026-11-02'), true);
    expectEqual(R.canReview(state, '2026-10-31', ACTIVATED), false);
    expectEqual(R.canReview(state, '2026-10-17', ACTIVATED), false); // before schedules started
  });

  test('shows scheduled, completed, and unfinished counts; ticked chores stay completed', function () {
    var data = R.reviewData(reviewState(), '2026-10-24', '2026-10-30');
    expectEqual(data.scheduled, 25);
    expectEqual(data.completed, 1);
    expectEqual(data.unfinished, 24);
    expectEqual(data.items.some(function (o) { return o.task.id === 'bathroom-clean-toilet'; }), false);
  });

  test('every unfinished chore defaults to Carry Over, and has only two choices', function () {
    var draft = R.createDraft(reviewState(), '2026-10-24', '2026-10-30');
    var decisions = Object.keys(draft.items).map(function (k) { return draft.items[k].decision; });
    expectEqual(decisions.length, 24);
    expectTrue(decisions.every(function (d) { return d === 'carry'; }), 'default carry');
  });

  test('carrying everything over saves the review and changes no chore', function () {
    var state = reviewState();
    var before = canon(state.records);
    var counts = R.applyReview(state, R.createDraft(state, '2026-10-24', '2026-10-30'), '2026-10-30');
    expectSame(counts, { done: 0, carried: 24, notes: 0, supplies: 0 });
    expectEqual(canon(state.records), before);
    expectEqual(state.reviews['2026-10-24'].reviewedOn, '2026-10-30');
    expectEqual(weeksOf(S.overdueOccurrences(state, 'bathroom', '2026-11-02'), MIRROR), ['2026-10-24']);
    expectEqual(weeksOf(S.overdueOccurrences(state, 'bathroom', '2026-11-02'), 'bathroom-change-bathroom-trash'), ['2026-10-24']);
  });

  test('Done marks the occurrence complete today and leaves the schedule alone', function () {
    var state = reviewState();
    R.applyReview(state, draftWith(state, '2026-10-24', '2026-11-01', { 'bathroom-clean-mirror|2026-10-24': { decision: 'done' } }), '2026-11-01');
    expectEqual(S.getRecord(state, MIRROR, '2026-10-24').completedOn, '2026-11-01');
    expectEqual(weeksOf(S.overdueOccurrences(state, 'bathroom', '2026-11-02'), MIRROR), []);
    expectEqual(S.nextDueWeek(state, S.findTask(state, MIRROR), '2026-11-02'), '2026-11-07');
  });

  test('carry-over notes are saved per occurrence and counted', function () {
    var state = reviewState();
    var counts = R.applyReview(state, draftWith(state, '2026-10-24', '2026-10-30', {
      'bathroom-change-bathroom-trash|2026-10-24': { note: 'I don\'t have trash bags' }
    }), '2026-10-30');
    expectEqual(counts.notes, 1);
    expectEqual(S.getRecord(state, 'bathroom-change-bathroom-trash', '2026-10-24').note, 'I don\'t have trash bags');
    expectEqual(S.getRecord(state, 'bathroom-change-bathroom-trash', '2026-10-24').status, undefined); // still open
  });

  test('an earlier review can be reopened and changed (Done back to Carry Over)', function () {
    var state = reviewState();
    R.applyReview(state, draftWith(state, '2026-10-24', '2026-10-30', { 'bathroom-clean-mirror|2026-10-24': { decision: 'done' } }), '2026-10-30');
    var again = R.createDraft(state, '2026-10-24', '2026-11-02');
    expectEqual(again.items['bathroom-clean-mirror|2026-10-24'].decision, 'done'); // listed so you can change it
    again.items['bathroom-clean-mirror|2026-10-24'].decision = 'carry';
    R.applyReview(state, again, '2026-11-02');
    expectEqual(S.getRecord(state, MIRROR, '2026-10-24'), null);
    expectEqual(weeksOf(S.overdueOccurrences(state, 'bathroom', '2026-11-02'), MIRROR), ['2026-10-24']);
    expectEqual(state.reviews['2026-10-24'].reviewedOn, '2026-10-30');
    expectEqual(state.reviews['2026-10-24'].updatedOn, '2026-11-02');
  });

  test('the review never adds supplies on confirm; it counts ones added while open', function () {
    var state = reviewState();
    var count = state.supplies.length;
    var draft = R.createDraft(state, '2026-10-24', '2026-10-30');
    expectEqual(draft.supplyChanges, 0);
    draft.items['bathroom-change-bathroom-trash|2026-10-24'].supply = 'Small trash bags'; // stray text is ignored
    draft.supplyChanges = 2; // the app counts each Add to Supplies tap while the review is open
    var counts = R.applyReview(state, draft, '2026-10-30');
    expectEqual(counts.supplies, 2);
    expectEqual(state.supplies.length, count);
    expectEqual(P.findSupply(state, 'Small trash bags'), null);
  });

  test('the summary preview changes nothing', function () {
    var state = reviewState();
    var before = canon(state);
    var counts = R.previewReview(state, draftWith(state, '2026-10-24', '2026-10-30', {
      'bathroom-clean-mirror|2026-10-24': { decision: 'done' },
      'bathroom-change-bathroom-trash|2026-10-24': { note: 'x' }
    }), '2026-10-30');
    expectSame(counts, { done: 1, carried: 23, notes: 1, supplies: 0 });
    expectEqual(canon(state), before);
  });

  test('reviews and notes are included in backups and restore exactly', function () {
    var state = reviewState();
    R.applyReview(state, draftWith(state, '2026-10-24', '2026-10-30', { 'bathroom-change-bathroom-trash|2026-10-24': { note: 'No bags' } }), '2026-10-30');
    var result = H.validateBackup(JSON.stringify(H.createBackup(state, new Date())), '2026-11-02');
    expectEqual(result.ok, true);
    expectSame(result.state, state);
    expectEqual(result.state.reviews['2026-10-24'].counts.carried, 24);
  });

  test('older 1.2 data without reviews or notes loads with safe defaults', function () {
    var old = freshState();
    delete old.reviews;
    var checked = H.validateState(copy(old));
    expectEqual(checked.ok, true);
    expectSame(checked.state.reviews, {});
  });

  test('damaged reviews or notes are rejected', function () {
    var a = freshState();
    a.reviews = { '2026-10-24': { reviewedOn: '2026-10-30', updatedOn: '2026-10-30', decisions: { 'x|2026-10-24': 'skip' }, counts: { done: 0, carried: 0, notes: 0, supplies: 0 } } };
    expectTrue(H.validateState(copy(a)).error.indexOf('week reviews') > -1, 'skip is not a choice');
    var b = freshState();
    b.records['bathroom-clean-toilet|2026-10-24'] = { taskId: 'bathroom-clean-toilet', week: '2026-10-24', room: 'bathroom', name: 'Clean toilet', note: '   ' };
    expectTrue(H.validateState(copy(b)).error.indexOf('completion records') > -1, 'blank note');
  });

  // ======================================================================
  section('Final QC: supply links and safe undo');

  test('older 1.2 data gets missing default supply links when loaded', function () {
    var old = freshState();
    old.tasks.forEach(function (t) { delete t.supplies; });
    var storage = fakeStorage({ 'householdReset.v2': JSON.stringify(old) });
    var loaded = H.loadState(storage, ACTIVATED);
    expectEqual(loaded.addedSupplyLinks, Object.keys(S.DEFAULT_TASK_SUPPLIES).length);
    expectEqual(S.findTask(loaded.state, 'whole-house-change-scent-booster-plugins').supplies, ['Scent plugin refills']);
    expectEqual(S.findTask(loaded.state, 'bathroom-clean-toilet').supplies, undefined); // no default: left as is
  });

  test('customised or cleared supply links are never overwritten', function () {
    var state = freshState();
    S.editTask(state, MIRROR, 'Clean mirror', 'biweekly', '2026-10-24', ACTIVATED, 'Microfiber cloth');
    S.editTask(state, 'kitchen-clean-oven', 'Clean oven', 'quarterly', null, ACTIVATED, '');
    var storage = fakeStorage({ 'householdReset.v2': JSON.stringify(state) });
    var loaded = H.loadState(storage, ACTIVATED).state;
    expectEqual(S.findTask(loaded, MIRROR).supplies, ['Microfiber cloth']);
    expectEqual(S.findTask(loaded, 'kitchen-clean-oven').supplies, []);
    expectEqual(P.prompts(loaded, '2026-12-28').some(function (p) { return p.task.id === 'kitchen-clean-oven'; }), false);
  });

  test('restoring an older 1.2 backup also adds missing default links', function () {
    var old = freshState();
    old.tasks.forEach(function (t) { delete t.supplies; });
    var result = H.validateBackup(JSON.stringify({ app: 'household-reset', backupVersion: 2, exportedAt: 'x', data: old }), ACTIVATED);
    expectEqual(S.findTask(result.state, 'whole-house-change-scent-booster-plugins').supplies, ['Scent plugin refills']);
  });

  test('undo keeps an added item you ticked on the Supplies tab since', function () {
    var state = freshState();
    var prompt = promptFor(state, '2026-11-02', 'whole-house-change-scent-booster-plugins');
    P.addToSupplies(state, prompt, '2026-11-02');
    P.findSupply(state, 'Scent plugin refills').done = true; // your manual change
    var result = P.undoAnswer(state, prompt.key);
    expectSame(result.kept, ['Scent plugin refills']);
    expectEqual(P.findSupply(state, 'Scent plugin refills').done, true);
    expectEqual(state.prep[prompt.key], undefined); // the answer itself is undone
  });

  test('undo leaves a marked item alone if you changed it since', function () {
    var state = freshState();
    state.supplies.push({ id: 'g1', name: 'Glass cleaner', done: false });
    var prompt = promptFor(state, '2026-11-02', MIRROR);
    P.addToSupplies(state, prompt, '2026-11-02'); // marks it (it was already needed)
    P.findSupply(state, 'Glass cleaner').done = true; // you bought it and ticked it
    var result = P.undoAnswer(state, prompt.key);
    expectSame(result.kept, ['Glass cleaner']);
    expectEqual(P.findSupply(state, 'Glass cleaner').done, true);
  });

  test('no prep questions are invented when next week needs nothing', function () {
    expectEqual(P.prompts(freshState(), ACTIVATED).length, 0); // next week is Oct 31–Nov 6
    expectEqual(P.nextWeek('2026-11-02'), '2026-11-07');
    expectTrue(P.prompts(freshState(), '2026-11-02').length > 0, 'Nov 7–13 has supply-linked chores');
  });

  // ======================================================================
  section('Week review corrections');

  function reviewedState() {
    var state = reviewState(); // toilet ticked in the checklist
    S.setNote(state, 'bathroom-change-bathroom-trash', '2026-10-24', 'No bags');
    state.supplies.push({ id: 'k1', name: 'Small trash bags', done: false });
    R.applyReview(state, draftWith(state, '2026-10-24', '2026-10-30', { 'bathroom-clean-mirror|2026-10-24': { decision: 'done' } }), '2026-10-30');
    return state;
  }

  test('undo week review removes only the review', function () {
    var state = reviewedState();
    var records = canon(state.records);
    var supplies = canon(state.supplies);
    var overdue = canon(S.overdueOccurrences(state, null, '2026-11-02').map(function (o) { return o.task.id + '|' + o.week; }));
    expectEqual(R.undoReview(state, '2026-10-24'), true);
    expectEqual(state.reviews['2026-10-24'], undefined);
    expectEqual(canon(state.records), records); // completions, dates, notes untouched
    expectEqual(canon(state.supplies), supplies);
    expectEqual(canon(S.overdueOccurrences(state, null, '2026-11-02').map(function (o) { return o.task.id + '|' + o.week; })), overdue);
    expectEqual(R.canReview(state, '2026-10-24', '2026-10-30'), true); // available again
    expectEqual(R.undoReview(state, '2026-10-24'), false); // nothing left to undo
  });

  test('a chore completed through the review stays completed after undo', function () {
    var state = reviewedState();
    R.undoReview(state, '2026-10-24');
    expectEqual(S.getRecord(state, MIRROR, '2026-10-24').status, 'done');
    expectEqual(S.getRecord(state, MIRROR, '2026-10-24').completedOn, '2026-10-30');
    expectEqual(S.getRecord(state, 'bathroom-clean-toilet', '2026-10-24').completedOn, '2026-10-26');
  });

  test('reviewing again after undo starts fresh and creates no duplicate records', function () {
    var state = reviewedState();
    R.undoReview(state, '2026-10-24');
    var recordCount = Object.keys(state.records).length;
    var data = R.reviewData(state, '2026-10-24', '2026-11-01');
    expectEqual(data.reviewedDone.length, 0);
    expectEqual(data.unfinished, 23);
    R.applyReview(state, R.createDraft(state, '2026-10-24', '2026-11-01'), '2026-11-01');
    expectEqual(Object.keys(state.records).length, recordCount);
    expectEqual(state.reviews['2026-10-24'].reviewedOn, '2026-11-01');
  });

  test('counts always agree: scheduled = completed + unfinished', function () {
    var state = reviewedState();
    [['2026-10-24', '2026-10-30'], ['2026-10-24', '2026-11-05'], ['2026-10-31', '2026-11-05']].forEach(function (c) {
      var d = R.reviewData(state, c[0], c[1]);
      expectEqual(d.scheduled, d.completed + d.unfinished);
      expectEqual(d.unfinished, d.unfinishedItems.length);
      expectTrue(d.unfinishedItems.every(function (o) { return o.status !== 'done'; }), 'no done chore counted as unfinished');
    });
  });

  test('when everything was marked Done in the review, nothing is listed as unfinished', function () {
    var state = freshState();
    var draft = R.createDraft(state, '2026-10-24', '2026-10-30');
    Object.keys(draft.items).forEach(function (k) { draft.items[k].decision = 'done'; });
    R.applyReview(state, draft, '2026-10-30');
    var data = R.reviewData(state, '2026-10-24', '2026-10-30');
    expectSame([data.scheduled, data.completed, data.unfinished], [25, 25, 0]);
    expectEqual(data.unfinishedItems.length, 0);
    expectEqual(data.reviewedDone.length, 25); // kept as labelled, editable history
  });

  test('room selector counts add up and show finished rooms', function () {
    var state = reviewedState();
    var rooms = R.roomSummary(state, '2026-10-24', '2026-10-30');
    var total = rooms.reduce(function (n, r) { return n + r.unfinished; }, 0);
    expectEqual(total, R.reviewData(state, '2026-10-24', '2026-10-30').unfinished);
    expectEqual(rooms.map(function (r) { return r.id; }), ['bathroom', 'kitchen', 'living-room', 'bedroom', 'cat-litter-room']);
    var bathroom = rooms[0];
    expectSame([bathroom.unfinished, bathroom.reviewedDone], [3, 1]);
    var cats = rooms.filter(function (r) { return r.id === 'cat-litter-room'; })[0];
    S.setDone(state, 'cat-litter-room-scoop-litter', '2026-10-24', '2026-10-30');
    S.setDone(state, 'cat-litter-room-vacuum-floor', '2026-10-24', '2026-10-30');
    expectEqual(cats.unfinished, 2);
    expectEqual(R.roomSummary(state, '2026-10-24', '2026-10-30').filter(function (r) { return r.id === 'cat-litter-room'; })[0].unfinished, 0);
  });

  test('switching rooms keeps unsaved choices (the draft covers every room)', function () {
    var state = reviewState();
    var draft = R.createDraft(state, '2026-10-24', '2026-10-30');
    draft.items['bathroom-clean-mirror|2026-10-24'].decision = 'done';
    draft.items['kitchen-clean-kitchen-sink|2026-10-24'].note = 'Out of soap';
    var counts = R.previewReview(state, draft, '2026-10-30');
    expectSame(counts, { done: 1, carried: 23, notes: 1, supplies: 0 }); // summary includes all rooms
  });

  test('supply button wording: add, mark as needed, already needed, or blank', function () {
    var state = freshState();
    state.supplies.push({ id: 'a', name: 'Glass cleaner', done: true }, { id: 'b', name: 'Sponges', done: false });
    expectEqual(R.supplyAction(state, 'Brand new thing'), 'add');
    expectEqual(R.supplyAction(state, '  glass  CLEANER '), 'mark');
    expectEqual(R.supplyAction(state, 'sponges'), 'already');
    expectEqual(R.supplyAction(state, '   '), null);
  });

  test('Add to Supplies: custom names, no duplicates, already-needed items unchanged', function () {
    var state = freshState();
    state.supplies.push({ id: 'b', name: 'Sponges', done: false }, { id: 'a', name: 'Glass cleaner', done: true });
    var n = state.supplies.length;
    expectEqual(P.addOrMarkSupply(state, 'Grout brush').action, 'added');
    expectEqual(P.addOrMarkSupply(state, 'grout BRUSH').action, 'already'); // just added (needed): no duplicate
    expectEqual(P.addOrMarkSupply(state, 'Glass Cleaner').action, 'marked');
    expectEqual(P.findSupply(state, 'Glass cleaner').done, false);
    expectEqual(P.addOrMarkSupply(state, 'sponges').action, 'already');
    expectEqual(P.addOrMarkSupply(state, '  '), null);
    expectEqual(state.supplies.length, n + 1);
  });

  test('a supply added from a chore survives a reload and a backup', function () {
    var state = freshState();
    P.addOrMarkSupply(state, 'Small trash bags');
    var storage = fakeStorage({});
    H.saveState(storage, state);
    var loaded = H.loadState(storage, '2026-10-26').state;
    expectEqual(P.findSupply(loaded, 'small trash bags').done, false);
    var restored = H.validateBackup(JSON.stringify(H.createBackup(loaded, new Date())), '2026-10-27').state;
    expectEqual(restored.supplies.filter(function (s) { return s.name === 'Small trash bags'; }).length, 1);
  });

  test('undoing a review survives a reload and a backup', function () {
    var state = reviewedState();
    R.undoReview(state, '2026-10-24');
    var storage = fakeStorage({});
    H.saveState(storage, state);
    var loaded = H.loadState(storage, '2026-10-31').state;
    expectSame(loaded.reviews, {});
    expectEqual(S.getRecord(loaded, MIRROR, '2026-10-24').status, 'done');
    var restored = H.validateBackup(JSON.stringify(H.createBackup(loaded, new Date())), '2026-11-01').state;
    expectSame(restored, loaded);
  });
})();
