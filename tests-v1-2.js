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

  test('damaged 1.1 data is left untouched and explained', function () {
    var storage = fakeStorage({ 'householdReset.v1': '{not valid json' });
    var loaded = H.loadState(storage, ACTIVATED);
    expectEqual(loaded.problem, true);
    expectTrue(loaded.state.legacy.note.indexOf('untouched') > -1, 'note');
    H.saveState(storage, loaded.state);
    expectEqual(storage.data['householdReset.v1'], '{not valid json');
  });

  test('damaged 1.2 data is kept as a safety copy before upgrading again', function () {
    var storage = fakeStorage({ 'householdReset.v1': JSON.stringify(V1_FIXTURE), 'householdReset.v2': '{"version": 2, "tasks": "oops"}' });
    var loaded = H.loadState(storage, ACTIVATED);
    expectEqual(loaded.damagedCopy, true);
    expectEqual(storage.data['householdReset.v2.damaged'], '{"version": 2, "tasks": "oops"}');
    expectEqual(loaded.source, 'migrated');
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
    expectSame(result.summary.added, { weeks: 4, keptWeeks: 0, chores: 4 });
  });

  test('scenario 2: restoring the same 1.1 backup twice adds nothing the second time', function () {
    var once = H.validateBackup(v1BackupText(V1_CUSTOM), '2026-10-28', initializedPreview());
    var twice = H.validateBackup(v1BackupText(V1_CUSTOM), '2026-10-29', once.state);
    expectSame(twice.state, once.state);
    expectSame(twice.summary.added, { weeks: 0, keptWeeks: 4, chores: 0 });
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
    expectEqual(loaded.source, 'new');
    expectEqual(loaded.damagedCopy, true);
    expectEqual(storage.data['householdReset.v2.damaged'], '{"version":2');
  });
})();
