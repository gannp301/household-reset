/*
 * app.js — makes the page work.
 *
 * It draws everything on screen, responds to taps, and saves changes.
 * The rules live in other files:
 *   logic.js    supplies, cat care, and version 1.1 backups (HouseholdLogic)
 *   schedule.js room chores and the Saturday–Friday calendar (HouseholdSchedule)
 *   laundry.js  laundry loads (HouseholdLaundry)
 *   storage.js  saving, loading, upgrading, backups (HouseholdStorage)
 */
(function () {
  'use strict';

  var L = window.HouseholdLogic;
  var S = window.HouseholdSchedule;
  var W = window.HouseholdLaundry;
  var H = window.HouseholdStorage;
  var P = window.HouseholdPrep;
  var R = window.HouseholdReview;
  var SUP = window.HouseholdSupplies;

  var state = null;
  // 'ok'          saving normally
  // 'paused'      saved data is damaged: nothing is saved until you choose what to do
  // 'unavailable' this browser's storage can't be read or used: nothing is saved
  var storageMode = 'ok';
  var loadResult = null;

  // Screen-only settings. These are never saved.
  var selectedWeek = null; // the cleaning week being looked at
  var shownCurrentWeek = null; // used to notice a new week starting while the app is open
  var openRoom = null; // id of the room being shown, or null for the list of rooms
  var expanded = null; // which chore row has its extra buttons showing
  var editingTask = null; // id of the room chore being edited
  var editingFrom = null; // set when editing from a checklist row ("taskId|week")
  var editingLoad = null; // id of the laundry load being renamed
  var editing = null; // supplies/cats row being edited: { list: 'supplies', id: '...' }
  var laundryMessage = '';

  function today() {
    return S.todayText(new Date());
  }

  function currentWeek() {
    return S.weekStart(today());
  }

  // ---------- Saving and loading ----------

  function getStorage() {
    try {
      return window.localStorage;
    } catch (err) {
      return null;
    }
  }

  function load() {
    var storage = getStorage();
    loadResult = storage
      ? H.loadState(storage, today())
      : { state: H.createState(today(), null), source: 'unreadable', canSave: false };
    state = loadResult.state;
    storageMode = loadResult.canSave ? 'ok' : loadResult.needsDecision ? 'paused' : 'unavailable';
    if (storageMode === 'unavailable') showUnavailableNotice();
    else if (storageMode === 'paused') showRecoveryNotice(loadResult);
    else if (loadResult.source === 'migrated') showUpgradeNotice();
    save();
  }

  // Saves the current data. Returns true only if it really was saved.
  function save() {
    if (storageMode !== 'ok') return false;
    var storage = getStorage();
    var ok = !!storage && H.saveState(storage, state);
    if (!ok) showStorageWarning();
    return ok;
  }

  function showStorageWarning() {
    var footer = document.querySelector('.app-footer p');
    if (footer && !document.getElementById('storage-warning')) {
      var warn = document.createElement('strong');
      warn.id = 'storage-warning';
      warn.textContent = ' Saving is turned off in this browser (for example in Private Browsing), so changes will be lost when you close the page.';
      footer.appendChild(warn);
    }
  }

  // Shows the message box at the top of the Rooms tab, with optional buttons.
  function showNotice(text, actions, canClose) {
    document.getElementById('app-notice-text').textContent = text;
    var box = document.getElementById('app-notice-actions');
    box.textContent = '';
    (actions || []).forEach(function (a) {
      var btn = el('button', 'btn ' + a.className, a.label);
      btn.type = 'button';
      btn.addEventListener('click', a.onClick);
      box.appendChild(btn);
    });
    document.getElementById('app-notice-close').hidden = !canClose;
    document.getElementById('app-notice').hidden = false;
  }

  function hideNotice() {
    document.getElementById('app-notice').hidden = true;
  }

  function showUpgradeNotice() {
    showNotice('Welcome to version 1.2! Your supplies, cat-care list, and old chore history were kept. ' +
      'The old weekly chore list is saved in History → Version 1.1 archive, and room chores start fresh from this week. ' +
      'Your version 1.1 data is also still stored, untouched, in this browser.', [], true);
  }

  function showUnavailableNotice() {
    showStorageWarning();
    showNotice('Household Reset couldn\'t read this browser\'s saved data, so it isn\'t saving anything right now. ' +
      'That way nothing already stored can be overwritten. Your saved data has not been changed. ' +
      'Try closing and reopening Safari. If you\'re in Private Browsing, switch to a normal tab.', [], false);
  }

  // Saved data is damaged. Nothing is saved until you pick one of these.
  function showRecoveryNotice(result) {
    var what = result.problem
      ? 'Your version 1.1 data in this browser is damaged and couldn\'t be upgraded.'
      : 'Your saved version 1.2 data in this browser is damaged and couldn\'t be opened.';
    var kept = result.damagedCopy
      ? ' A safety copy of the damaged data was kept, and your other saved data hasn\'t been changed.'
      : ' It has not been changed or deleted.';
    var continueLabel = result.problem || !loadResult.state.legacy ? 'Start fresh' : 'Use my version 1.1 lists';
    showNotice(what + kept + ' Nothing will be saved until you choose: restore a backup file, ' +
      'download a copy of the old data to keep, or ' + continueLabel.toLowerCase() + '.', [
      { label: 'Restore from a backup', className: 'btn-primary', onClick: function () {
        document.getElementById('restore-file').click();
      } },
      { label: 'Download the old data', className: 'btn-quiet', onClick: downloadOldData },
      { label: continueLabel, className: 'btn-quiet', onClick: function () {
        if (!window.confirm(continueLabel + '? The damaged data stays stored in this browser, but the app will stop using it.')) return;
        storageMode = 'ok';
        if (save()) hideNotice();
        render();
      } }
    ], false);
  }

  function downloadOldData() {
    var storage = getStorage();
    var raw = storage ? H.rawSavedData(storage) : {};
    var file = {
      note: 'Raw Household Reset data copied from this browser, exactly as stored (it may be damaged).',
      copiedAt: new Date().toISOString(),
      data: raw
    };
    downloadFile('household-reset-old-data-' + today() + '.json', JSON.stringify(file, null, 2));
  }

  // ---------- Small helpers for building the page ----------

  // el('button', 'btn', 'Edit') makes <button class="btn">Edit</button>.
  // textContent keeps typed text safe: it's shown as text, never run as code.
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function button(action, label, className, data) {
    var btn = el('button', 'btn ' + (className || 'btn-small'), label);
    btn.type = 'button';
    btn.dataset.action = action;
    Object.keys(data || {}).forEach(function (key) { btn.dataset[key] = data[key]; });
    return btn;
  }

  function actionButton(action, label, ariaLabel, extraClass) {
    var btn = button(action, label, 'btn-small' + (extraClass ? ' ' + extraClass : ''));
    btn.setAttribute('aria-label', ariaLabel);
    return btn;
  }

  function count(n, one, many) {
    return n + ' ' + (n === 1 ? one : many);
  }

  function setProgress(barId, fillId, percent) {
    document.getElementById(fillId).style.width = percent + '%';
    document.getElementById(barId).setAttribute('aria-valuenow', String(percent));
  }

  function freqBadge(frequency) {
    var f = S.FREQUENCIES[frequency];
    return el('span', 'badge freq freq-' + frequency, f.icon + ' ' + f.label);
  }

  function roomName(id) {
    var room = S.roomById(id);
    return room ? room.name : 'Room';
  }

  function miniProgress(percent) {
    var track = el('div', 'progress-track mini');
    var fill = el('div', 'progress-fill');
    fill.style.width = percent + '%';
    track.appendChild(fill);
    return track;
  }

  function sectionBlock(title, hint) {
    var block = el('div', 'card room-section');
    block.appendChild(el('h3', '', title));
    if (hint) block.appendChild(el('p', 'hint', hint));
    return block;
  }

  // ---------- Week navigator and overview ----------

  function renderWeek() {
    var cw = currentWeek();
    var ov = S.overview(state, selectedWeek, today());
    document.getElementById('week-label').textContent = 'Cleaning week: ' + S.formatWeekRange(cw);
    document.getElementById('week-eyebrow').textContent =
      selectedWeek === cw ? 'This cleaning week' : selectedWeek < cw ? 'Past cleaning week' : 'Future cleaning week';
    document.getElementById('week-range').textContent = S.formatWeekRange(selectedWeek);
    document.getElementById('this-week').hidden = selectedWeek === cw;

    // Finish Cleaning Week: this week or earlier weeks only.
    var review = state.reviews[selectedWeek];
    var finish = document.getElementById('finish-week');
    document.getElementById('review-row').hidden = !R.canReview(state, selectedWeek, today());
    finish.textContent = review ? 'Edit week review' : 'Finish Cleaning Week';
    document.getElementById('undo-review').hidden = !review;
    var reviewStatus = document.getElementById('review-status');
    reviewStatus.hidden = !review && !weekMessage;
    reviewStatus.textContent = weekMessage || (review ? '✓ Reviewed ' + S.formatShort(review.updatedOn) : '');

    var stats = document.getElementById('overview-stats');
    stats.textContent = '';
    [
      ['Due', ov.due, ''],
      ['Completed', ov.completed, ''],
      ['Overdue', ov.overdue, ov.overdue ? 'stat-overdue' : ''],
      ['Next week', ov.nextWeek, '']
    ].forEach(function (s) {
      var tile = el('div', 'stat ' + s[2]);
      tile.appendChild(el('span', 'stat-num', String(s[1])));
      tile.appendChild(el('span', 'stat-label', s[0]));
      stats.appendChild(tile);
    });

    var percent = ov.due === 0 ? 0 : Math.round((ov.completed / ov.due) * 100);
    setProgress('progress-bar', 'progress-fill', percent);
    document.getElementById('week-note').textContent = ov.isBeforeActivation
      ? 'This week is before you started room schedules (week of ' + S.formatShort(state.activatedWeek) +
        '), so nothing is tracked here. Older records are in History → Version 1.1 archive.'
      : 'Due and Completed are for the week shown. Overdue counts missed chores from all earlier weeks. ' +
        'Next week counts less-frequent chores due in the week after the one shown.';
  }

  // ---------- Rooms home: heads up, room cards, next-week prep ----------

  // ---------- Heads up ----------

  var HEADS_UP_STYLE = {
    overdue: { icon: '⚠', className: 'hu-overdue' },
    due: { icon: '★', className: 'hu-due' },
    soon: { icon: '◷', className: 'hu-soon' }
  };
  var openHeadsUp = {}; // which groups you've expanded (kept while the app is open)
  var openHeadsUpRooms = {}; // which room sections inside them you've expanded

  // "2 monthly · 1 every 2 weeks"
  function frequencyBreakdown(items) {
    var counts = {};
    items.forEach(function (i) { counts[i.task.frequency] = (counts[i.task.frequency] || 0) + 1; });
    return Object.keys(S.FREQUENCIES).filter(function (f) { return counts[f]; }).map(function (f) {
      return counts[f] + ' ' + S.FREQUENCIES[f].label.toLowerCase();
    }).join(' · ');
  }

  // "Oct 24", "Oct 17 & Oct 24", or "Oct 10 – Oct 24" for the original due weeks.
  function weeksLabel(items) {
    var weeks = [];
    items.forEach(function (i) { if (weeks.indexOf(i.week) === -1) weeks.push(i.week); });
    weeks.sort();
    if (weeks.length === 1) return S.formatShort(weeks[0]);
    if (weeks.length === 2) return S.formatShort(weeks[0]) + ' & ' + S.formatShort(weeks[1]);
    return S.formatShort(weeks[0]) + ' – ' + S.formatShort(weeks[weeks.length - 1]);
  }

  // [title, short detail] for one Heads up row. Titles name the exact dates.
  function headsUpText(group, relation, week) {
    var n = group.items.length;
    if (group.kind === 'overdue') {
      return ['Overdue from ' + weeksLabel(group.items),
        relation === 'current' ? count(n, 'chore', 'chores') + ' still open from earlier weeks'
          : count(n, 'chore', 'chores') + ' from this week, still not done'];
    }
    if (group.kind === 'due') {
      return ['Due ' + S.formatRangeShort(week),
        count(n, 'less-frequent chore', 'less-frequent chores') + ' · ' + frequencyBreakdown(group.items)];
    }
    return [(relation === 'current' ? 'Coming next week: ' : 'Coming the week after: ') + S.formatRangeShort(group.week),
      count(n, 'monthly or quarterly chore', 'monthly or quarterly chores') + ' · ' + frequencyBreakdown(group.items)];
  }

  function headsUpItem(item, kind) {
    var li = el('li', 'hu-item');
    li.appendChild(el('span', 'hu-item-name', item.task.name));
    var badges = el('span', 'badges');
    badges.appendChild(freqBadge(item.task.frequency));
    if (kind === 'overdue') badges.appendChild(el('span', 'badge status-overdue', 'Overdue'));
    else if (item.effectiveWeek !== item.week) badges.appendChild(el('span', 'badge status-moved', 'Moved to ' + S.formatShort(item.effectiveWeek)));
    li.appendChild(badges);
    if (item.note) li.appendChild(el('p', 'hu-note', 'Note: ' + item.note));
    return li;
  }

  // Follows the week selected in the navigator, and says which week that is.
  function renderHeadsUp() {
    var hu = S.headsUp(state, selectedWeek, today());
    var context = {
      current: 'today\'s week',
      past: 'a past week you\'re viewing (not today\'s week)',
      future: 'a future week you\'re viewing (not today\'s week)'
    }[hu.relation];
    var scope = document.getElementById('heads-up-scope');
    scope.textContent = 'Summarizing ' + S.formatRangeShort(selectedWeek) + ' · ' + context;
    scope.className = 'hint hu-scope' + (hu.relation === 'current' ? '' : ' hu-scope-other');
    var box = document.getElementById('heads-up-groups');
    box.textContent = '';

    if (hu.beforeActivation || !hu.groups.length) {
      box.appendChild(el('p', 'hu-clear', hu.beforeActivation
        ? 'Room schedules hadn\'t started yet in this week.'
        : '✓ All clear. Nothing needs extra attention ' + (hu.relation === 'current' ? 'this week.' : 'in this week.')));
      return;
    }

    var list = el('ul', 'hu-list');
    hu.groups.forEach(function (group) {
      var style = HEADS_UP_STYLE[group.kind];
      var text = headsUpText(group, hu.relation, selectedWeek);
      var li = el('li');
      var details = el('details', 'hu-group ' + style.className);
      details.open = !!openHeadsUp[group.kind];
      var summary = el('summary', 'hu-summary');
      var icon = el('span', 'hu-icon', style.icon);
      icon.setAttribute('aria-hidden', 'true');
      var words = el('span', 'hu-text');
      words.appendChild(el('strong', 'hu-title', text[0]));
      words.appendChild(el('span', 'hu-sub', text[1]));
      var toggle = el('span', 'hu-toggle', details.open ? 'Hide details' : 'Show details');
      summary.appendChild(icon);
      summary.appendChild(words);
      summary.appendChild(toggle);
      details.appendChild(summary);

      // Inside each reminder, one collapsible section per room that has any.
      var rooms = el('div', 'hu-rooms');
      S.ROOMS.forEach(function (room) {
        var inRoom = group.items.filter(function (i) { return i.task.room === room.id; });
        if (!inRoom.length) return;
        var key = group.kind + '|' + room.id;
        var roomBox = el('details', 'hu-room');
        roomBox.open = !!openHeadsUpRooms[key];
        var roomSummary = el('summary', 'hu-room-summary');
        roomSummary.appendChild(el('span', 'hu-room-name', room.icon + ' ' + room.name));
        roomSummary.appendChild(el('span', 'hu-room-count', String(inRoom.length)));
        roomSummary.setAttribute('aria-label', room.name + ', ' + count(inRoom.length, 'chore', 'chores'));
        roomBox.appendChild(roomSummary);
        var items = el('ul', 'hu-items');
        inRoom.forEach(function (item) { items.appendChild(headsUpItem(item, group.kind)); });
        roomBox.appendChild(items);
        roomBox.addEventListener('toggle', function () { openHeadsUpRooms[key] = roomBox.open; });
        rooms.appendChild(roomBox);
      });
      details.appendChild(rooms);
      details.addEventListener('toggle', function () {
        openHeadsUp[group.kind] = details.open;
        toggle.textContent = details.open ? 'Hide details' : 'Show details';
      });
      li.appendChild(details);
      list.appendChild(li);
    });
    box.appendChild(list);
  }

  // Which cleaning week laundry put-away reminders are measured against.
  // Laundry isn't saved per week, so it always shows today's real loads:
  //  - this week or a past week: loads finished before THIS week and not
  //    put away are overdue;
  //  - a future week: those, plus loads that would still be waiting by then
  //    ("Not put away yet"). Looking ahead never marks anything overdue.
  function laundryWeek() {
    var cw = currentWeek();
    return selectedWeek > cw ? selectedWeek : cw;
  }

  // Laundry's status line, plus any chores you added to the Laundry room
  // yourself (as text only: laundry has no percentage bar).
  function laundrySummary(progress) {
    var text = W.statusLine(state.laundry) +
      (progress.total ? ' · ' + progress.done + ' of ' + progress.total + ' chores done' : '');
    return text.replace(/(\d) /g, '$1\u00a0'); // keep "1 waiting" together when it wraps
  }

  function renderRoomGrid() {
    var grid = document.getElementById('room-grid');
    grid.textContent = '';
    var t = today();
    var before = selectedWeek < state.activatedWeek;
    S.ROOMS.forEach(function (room) {
      var progress = S.progressOf(S.occurrencesForWeek(state, room.id, selectedWeek, t));
      var overdue = S.overdueOccurrences(state, room.id, t).length;
      var card = el('button', 'room-card');
      card.type = 'button';
      card.dataset.room = room.id;

      var top = el('span', 'room-top');
      var icon = el('span', 'room-icon', room.icon);
      icon.setAttribute('aria-hidden', 'true');
      top.appendChild(icon);
      top.appendChild(el('span', 'room-name', room.name));
      card.appendChild(top);

      var meta;
      if (room.id === 'laundry') {
        meta = laundrySummary(progress);
      } else if (before) {
        meta = 'Not tracked this week';
      } else {
        meta = progress.total ? progress.done + ' of ' + progress.total + ' done' : 'Nothing due this week';
      }
      card.appendChild(el('span', 'room-meta', meta));
      if (room.id !== 'laundry') card.appendChild(miniProgress(progress.percent));
      if (overdue) card.appendChild(el('span', 'chip chip-overdue', '⚠ ' + overdue + ' overdue'));
      if (room.id === 'laundry') {
        var lateLoads = W.overduePutAway(state.laundry, laundryWeek()).length;
        if (lateLoads) card.appendChild(el('span', 'chip chip-overdue', '⚠ ' + count(lateLoads, 'load', 'loads') + ' to put away from earlier weeks'));
      }
      card.setAttribute('aria-label', room.name + ': ' + meta + (overdue ? ', ' + overdue + ' overdue' : ''));
      grid.appendChild(card);
    });
  }

  // ---------- Get ready for next week ----------

  var prepOpenChoice = null; // null = open automatically when something needs an answer
  var prepMessage = '';
  var settingPrepOpen = false;

  function joinNames(names) {
    if (names.length <= 1) return names.join('');
    return names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
  }

  var SUPPLY_STATUS = {
    missing: 'not on your Supplies list',
    ticked: 'on your Supplies list, ticked as stocked',
    needed: 'on your Supplies list, marked as needed'
  };

  var ADD_LABELS = { add: 'Add to supplies', mark: 'Mark as needed', both: 'Add / mark as needed' };

  function supplyNamesById(ids) {
    return state.supplies.filter(function (s) { return ids.indexOf(s.id) > -1; }).map(function (s) { return s.name; });
  }

  // One row per question. `group` holds every chore occurrence next week that
  // needs exactly these supplies.
  function renderPrepGroup(group) {
    var first = group.prompts[0];
    var names = group.supplies.map(function (s) { return s.name; });
    var li = el('li', 'prep-item freq-' + first.task.frequency);

    var forList = el('ul', 'prep-chores');
    forList.setAttribute('aria-label', 'Chores next week that need ' + joinNames(names));
    group.prompts.forEach(function (p) {
      var row = el('li');
      row.appendChild(el('span', 'prep-chore', p.task.name));
      row.appendChild(el('span', 'badge', roomName(p.task.room)));
      forList.appendChild(row);
    });

    var actions = el('div', 'prep-actions');
    if (!group.pending.length) {
      var a = first.answer;
      var said;
      if (a.answer === 'stocked') {
        said = '✓ You have ' + joinNames(names) + '.';
      } else {
        var added = [];
        var marked = [];
        group.prompts.forEach(function (p) {
          added = added.concat(supplyNamesById(p.answer.added));
          marked = marked.concat(supplyNamesById(p.answer.marked.map(function (m) { return m.id; })));
        });
        marked = marked.filter(function (n) { return added.indexOf(n) === -1; });
        var parts = [];
        if (added.length) parts.push('Added ' + joinNames(added) + ' to Supplies');
        if (marked.length) parts.push((added.length ? 'marked ' : 'Marked ') + joinNames(marked) + ' as needed');
        said = '✓ ' + (parts.length ? parts.join(' and ') : 'Updated Supplies') + '.';
      }
      li.appendChild(el('p', 'prep-answer', said));
      li.appendChild(forList);
      var change = button('prep-undo', 'Change answer', 'btn-small', { group: group.key });
      change.setAttribute('aria-label', 'Change answer about ' + joinNames(names));
      actions.appendChild(change);
    } else {
      li.appendChild(el('p', 'prep-question', 'Do you have ' + joinNames(names) + '?'));
      li.appendChild(el('p', 'prep-status', group.supplies.map(function (s) {
        return s.name + ': ' + SUPPLY_STATUS[s.status];
      }).join(' · ')));
      li.appendChild(forList);
      var stocked = button('prep-stocked', 'I\'m stocked', 'btn-quiet btn-compact', { group: group.key });
      stocked.setAttribute('aria-label', 'I\'m stocked with ' + joinNames(names));
      var addLabel = ADD_LABELS[P.addAction(group.pending[0])];
      var add = button('prep-add', addLabel, 'btn-primary btn-compact', { group: group.key });
      add.setAttribute('aria-label', addLabel + ': ' + joinNames(names));
      actions.appendChild(stocked);
      actions.appendChild(add);
    }
    li.appendChild(actions);
    return li;
  }

  // Only next week's chores that list supplies they need.
  function renderPrep() {
    var t = today();
    var groups = P.groupPrompts(P.prompts(state, t));
    var pending = groups.filter(function (g) { return g.pending.length; }).length;
    document.getElementById('prep-scope').textContent = 'Next week: ' + S.formatWeekRange(P.nextWeek(t)) +
      '. Only chores that need supplies are listed.';
    document.getElementById('prep-count').textContent = pending
      ? pending + ' to check' : groups.length ? 'All set' : 'Nothing needed';
    var card = document.getElementById('prep-card');
    var shouldOpen = prepOpenChoice === null ? pending > 0 : prepOpenChoice;
    if (card.open !== shouldOpen) {
      settingPrepOpen = true;
      card.open = shouldOpen;
    }

    var ul = document.getElementById('prep-list');
    ul.textContent = '';
    if (prepMessage) ul.appendChild(el('li', 'prep-message', prepMessage));
    if (!groups.length) {
      ul.appendChild(el('li', 'hu-clear', 'Nothing to prepare for next week.'));
      return;
    }
    groups.forEach(function (group) { ul.appendChild(renderPrepGroup(group)); });
  }

  // Answers (or undoes) the question for every chore in the group. Each
  // chore occurrence still gets its own saved answer.
  function onPrepClick(event) {
    var btn = event.target.closest('button[data-action]');
    if (!btn) return;
    var key = btn.dataset.group;
    var t = today();
    var group = P.groupPrompts(P.prompts(state, t)).filter(function (g) { return g.key === key; })[0];
    if (!group) return;
    var action = btn.dataset.action;
    prepMessage = '';
    if (action === 'prep-undo') {
      var kept = [];
      group.prompts.slice().reverse().forEach(function (p) {
        var result = P.undoAnswer(state, p.key);
        if (result && result.kept) kept = kept.concat(result.kept);
      });
      if (kept.length) {
        prepMessage = 'Answer undone. ' + joinNames(kept.filter(function (n, i) { return kept.indexOf(n) === i; })) +
          ' stayed as you set it on the Supplies tab.';
      }
    } else if (action === 'prep-stocked') {
      group.pending.forEach(function (p) { P.answerStocked(state, p, t); });
    } else if (action === 'prep-add') {
      group.pending.forEach(function (p) { P.addToSupplies(state, p, t); });
    } else {
      return;
    }
    save();
    render();
    var again = document.querySelector('#prep-list [data-group="' + key.replace(/"/g, '\\"') + '"]');
    if (again) again.focus();
  }

  function renderLegend() {
    var ul = document.getElementById('legend-list');
    ul.textContent = '';
    Object.keys(S.FREQUENCIES).forEach(function (f) {
      var li = el('li');
      li.appendChild(freqBadge(f));
      ul.appendChild(li);
    });
    var li = el('li');
    li.appendChild(el('span', 'badge status-overdue', '⚠ Overdue'));
    ul.appendChild(li);
  }

  // ---------- One room ----------

  function occurrenceKey(o) {
    return o.task.id + '|' + o.week;
  }

  // Short status labels only. The original scheduled week is still stored
  // (History and overdue rules use it); the checklist doesn't repeat it.
  function statusBadges(o) {
    var badges = [];
    var moved = o.effectiveWeek !== o.week;
    if (o.status === 'done') {
      badges.push(el('span', 'badge status-done', '✓ Done ' + S.formatShort(o.record.completedOn)));
    } else if (o.status === 'skipped') {
      // Saved by an older version, when Skip meant "dismiss". Kept as it was.
      badges.push(el('span', 'badge status-skipped', 'Skipped (dismissed)'));
    } else if (o.status === 'overdue') {
      badges.push(el('span', 'badge status-overdue', '⚠ Overdue'));
    } else if (moved) {
      badges.push(el('span', 'badge status-moved', 'Moved to ' + S.formatShort(o.effectiveWeek)));
    } else if (o.status === 'due' && o.effectiveWeek < selectedWeek) {
      badges.push(el('span', 'badge status-upcoming', 'Due this week'));
    }
    if (o.deferred && !moved && o.status !== 'done' && o.status !== 'skipped') {
      badges.push(el('span', 'badge status-skipped', 'Skipped for now'));
    }
    return badges;
  }

  // The weeks a chore can be moved to: this week and the next 8.
  function moveSelect(o) {
    var select = el('select', 'move-select');
    select.setAttribute('aria-label', 'Move "' + o.task.name + '" to week');
    var cw = currentWeek();
    for (var i = 0; i <= 8; i++) {
      var week = S.addWeeks(cw, i);
      if (week === o.effectiveWeek) continue;
      var option = el('option', '', (i === 0 ? 'This week' : i === 1 ? 'Next week' : 'Week of ' + S.formatShort(week)));
      option.value = week;
      select.appendChild(option);
    }
    return select;
  }

  function renderOccurrence(o) {
    var done = o.status === 'done';
    var li = el('li', 'item task-row freq-' + o.task.frequency + ' status-' + o.status + (done ? ' done' : ''));
    var data = { task: o.task.id, week: o.week };

    // Editing this chore from the checklist (More → Edit chore).
    if (editingTask === o.task.id && editingFrom === occurrenceKey(o)) {
      li.appendChild(el('p', 'edit-heading', 'Edit chore: ' + o.task.name));
      li.appendChild(renderTaskForm(o.task));
      return li;
    }

    var check = button('toggle-done', done ? '✓' : '', 'check', data);
    check.className = 'check';
    check.setAttribute('aria-pressed', String(done));
    check.setAttribute('aria-label', 'Mark "' + o.task.name + '" as ' + (done ? 'not done' : 'done'));

    var body = el('div', 'item-body');
    body.appendChild(el('span', 'item-name', o.task.name));
    var badges = el('span', 'badges');
    badges.appendChild(freqBadge(o.task.frequency));
    statusBadges(o).forEach(function (b) { badges.appendChild(b); });
    var note = o.record && o.record.note ? o.record.note : '';
    if (note) {
      var noteBadge = el('span', 'badge note-badge', '📝 Note');
      noteBadge.title = note;
      noteBadge.setAttribute('aria-label', 'Has a note: ' + note);
      badges.appendChild(noteBadge);
    }
    body.appendChild(badges);

    var isOpen = expanded === occurrenceKey(o);
    var more = button('more', isOpen ? 'Close' : 'More', 'btn-small', data);
    more.setAttribute('aria-expanded', String(isOpen));
    more.setAttribute('aria-label', (isOpen ? 'Close options for "' : 'More options for "') + o.task.name + '"');

    var row = el('div', 'row-main');
    row.appendChild(check);
    row.appendChild(body);
    row.appendChild(more);
    li.appendChild(row);

    if (isOpen) {
      var actions = el('div', 'row-actions');
      var editChore = button('edit-task-inline', 'Edit chore', 'btn-quiet', data);
      editChore.setAttribute('aria-label', 'Edit chore "' + o.task.name + '" (name, frequency, supplies)');
      actions.appendChild(editChore);
      var skippedNow = o.deferred && !done && o.status !== 'skipped';
      if (o.status === 'skipped') {
        // An older "dismissed" skip: reopening it is your choice.
        actions.appendChild(button('undo-old-skip', 'Undo skip (reopen)', 'btn-quiet', data));
      } else if (!done && !o.deferred) {
        actions.appendChild(button('skip-now', 'Skip for now', 'btn-quiet', data));
      }
      li.appendChild(actions);
      if (!skippedNow && !note) return li;

      // Shown after "Skip for now" (or when this occurrence already has a note).
      var more = el('div', 'skip-panel');
      if (skippedNow) {
        more.appendChild(el('p', 'hint', 'Skipped for now: it stays unfinished and becomes overdue if its week ends.'));
      }
      // A note for this occurrence only (it stays in History).
      var noteWrap = el('div', 'note-wrap');
      var noteInput = el('input');
      noteInput.type = 'text';
      noteInput.className = 'note-input';
      noteInput.maxLength = 200;
      noteInput.value = note;
      noteInput.placeholder = 'Reason or note (optional)';
      noteInput.setAttribute('aria-label', 'Note for "' + o.task.name + '" (week of ' + S.formatShort(o.week) + ')');
      noteWrap.appendChild(noteInput);
      noteWrap.appendChild(button('save-note', note ? 'Save note' : 'Add note', 'btn-quiet', data));
      if (note) noteWrap.appendChild(button('clear-note', 'Clear note', 'btn-small', data));
      more.appendChild(noteWrap);
      if (skippedNow) {
        more.appendChild(renderSupplyAdder(o.task, 'room:' + occurrenceKey(o)));
        var moveWrap = el('div', 'move-wrap');
        moveWrap.appendChild(el('span', 'move-label', 'Move to another cleaning week:'));
        moveWrap.appendChild(moveSelect(o));
        moveWrap.appendChild(button('move', 'Move', 'btn-quiet', data));
        more.appendChild(moveWrap);
        more.appendChild(button('undo-skip-now', 'Undo Skip', 'btn-quiet', data));
      }
      li.appendChild(more);
    }
    return li;
  }

  function renderAsNeeded(task) {
    var last = S.lastDone(state, task.id);
    var doneToday = last === today();
    var li = el('li', 'item task-row freq-asneeded' + (doneToday ? ' done' : ''));
    var row = el('div', 'row-main');
    var check = button('asneeded-done', doneToday ? '✓' : '', 'check', { task: task.id });
    check.className = 'check';
    check.setAttribute('aria-pressed', String(doneToday));
    check.setAttribute('aria-label', doneToday ? 'Undo today\'s "' + task.name + '"' : 'Mark "' + task.name + '" done today');
    var body = el('div', 'item-body');
    body.appendChild(el('span', 'item-name', task.name));
    var badges = el('span', 'badges');
    badges.appendChild(freqBadge('asneeded'));
    badges.appendChild(el('span', 'badge', last ? 'Last done ' + S.formatShort(last) : 'Not done yet'));
    body.appendChild(badges);
    row.appendChild(check);
    row.appendChild(body);
    li.appendChild(row);
    return li;
  }

  // The first weeks a biweekly chore would be due with a given rotation.
  function rotationLabel(anchor) {
    var week = currentWeek();
    while (!S.isDueInWeek({ frequency: 'biweekly', anchor: anchor }, week)) week = S.addWeeks(week, 1);
    return 'Due weeks of ' + S.formatShort(week) + ', ' + S.formatShort(S.addWeeks(week, 2)) + '…';
  }

  // The form for adding a chore, or editing one (when `task` is given).
  function renderTaskForm(task) {
    var form = el('form', 'task-form');
    form.dataset.mode = task ? 'edit' : 'add';
    if (task) form.dataset.task = task.id;

    var name = el('input');
    name.type = 'text';
    name.name = 'name';
    name.maxLength = 80;
    name.autocomplete = 'off';
    name.placeholder = 'Add a chore…';
    name.value = task ? task.name : '';
    name.setAttribute('aria-label', 'Chore name');
    form.appendChild(name);

    var freq = el('select');
    freq.name = 'frequency';
    freq.setAttribute('aria-label', 'How often');
    Object.keys(S.FREQUENCIES).forEach(function (f) {
      var option = el('option', '', S.FREQUENCIES[f].icon + ' ' + S.FREQUENCIES[f].label);
      option.value = f;
      freq.appendChild(option);
    });
    freq.value = task ? task.frequency : 'weekly';
    form.appendChild(freq);

    var rotation = el('select');
    rotation.name = 'anchor';
    rotation.className = 'rotation-select';
    rotation.setAttribute('aria-label', 'Which weeks (every 2 weeks)');
    [S.BIWEEKLY_ANCHOR, S.addWeeks(S.BIWEEKLY_ANCHOR, 1)].forEach(function (anchor) {
      var option = el('option', '', rotationLabel(anchor));
      option.value = anchor;
      rotation.appendChild(option);
    });
    rotation.value = task && task.anchor ? task.anchor : S.BIWEEKLY_ANCHOR;
    rotation.hidden = freq.value !== 'biweekly';
    form.appendChild(rotation);

    // Optional supplies, used by "Get ready for next week".
    var supplies = el('input');
    supplies.type = 'text';
    supplies.name = 'supplies';
    supplies.maxLength = 200;
    supplies.autocomplete = 'off';
    supplies.className = 'supplies-input';
    supplies.placeholder = 'Supplies it needs (optional, separate with commas)';
    supplies.value = task && task.supplies ? task.supplies.join(', ') : '';
    supplies.setAttribute('aria-label', 'Supplies this chore needs (optional, separate with commas)');
    form.appendChild(supplies);

    var submit = el('button', 'btn btn-primary', task ? 'Save Changes' : 'Add');
    submit.type = 'submit';
    form.appendChild(submit);
    if (task) form.appendChild(button('cancel-edit', 'Cancel', 'btn-quiet'));
    if (task) form.appendChild(el('p', 'hint form-hint', 'Changing how often a chore repeats starts the new schedule from this week.'));
    return form;
  }

  var openFreqGroups = {}; // which frequency groups you've opened, per room (screen only)

  function renderManageRow(task) {
    var li = el('li', 'item manage-row freq-' + task.frequency);
    if (editingTask === task.id && !editingFrom) {
      li.appendChild(renderTaskForm(task));
      return li;
    }
    var body = el('div', 'item-body');
    body.appendChild(el('span', 'item-name', task.name));
    var badges = el('span', 'badges');
    var next = S.nextDueWeek(state, task, today());
    if (next) badges.appendChild(el('span', 'badge', 'Next due ' + S.formatShort(next)));
    if (task.supplies && task.supplies.length) badges.appendChild(el('span', 'badge', 'Needs: ' + task.supplies.join(', ')));
    body.appendChild(badges);
    var actions = el('div', 'item-actions');
    var edit = button('edit-task', 'Edit', 'btn-small', { task: task.id });
    edit.setAttribute('aria-label', 'Edit "' + task.name + '"');
    var del = button('delete-task', 'Delete', 'btn-small btn-danger', { task: task.id });
    del.setAttribute('aria-label', 'Delete "' + task.name + '"');
    actions.appendChild(edit);
    actions.appendChild(del);
    li.appendChild(body);
    li.appendChild(actions);
    return li;
  }

  // One collapsible section per frequency (empty ones are left out). Several
  // can be open at once.
  function renderManageList(roomId) {
    var wrap = el('div', 'freq-groups');
    var tasks = state.tasks.filter(function (t) { return t.room === roomId; });
    if (!tasks.length) {
      wrap.appendChild(el('p', 'empty', 'No chores in this room yet. Add one above.'));
      return wrap;
    }
    Object.keys(S.FREQUENCIES).forEach(function (f) {
      var group = tasks.filter(function (t) { return t.frequency === f; });
      if (!group.length) return;
      var key = roomId + '|' + f;
      var details = el('details', 'freq-group freq-' + f);
      var editingHere = group.some(function (t) { return t.id === editingTask && !editingFrom; });
      details.open = !!openFreqGroups[key] || editingHere;
      var summary = el('summary', 'freq-group-summary');
      summary.appendChild(freqBadge(f));
      summary.appendChild(el('span', 'freq-group-count', count(group.length, 'chore', 'chores')));
      details.appendChild(summary);
      var ul = el('ul', 'item-list');
      group.forEach(function (task) { ul.appendChild(renderManageRow(task)); });
      details.appendChild(ul);
      details.addEventListener('toggle', function () { openFreqGroups[key] = details.open; });
      wrap.appendChild(details);
    });
    return wrap;
  }

  function renderRoomView() {
    var room = S.roomById(openRoom);
    var t = today();
    var cw = currentWeek();
    var occurrences = S.occurrencesForWeek(state, room.id, selectedWeek, t);
    var progress = S.progressOf(occurrences);
    var before = selectedWeek < state.activatedWeek;

    document.getElementById('room-title').textContent = room.icon + ' ' + room.name;
    var isLaundry = room.id === 'laundry';
    // Laundry loads aren't saved per week, so its status is always today's.
    document.getElementById('room-progress-text').textContent = isLaundry ? laundrySummary(progress)
      : before ? 'Not tracked'
      : progress.total ? progress.done + ' of ' + progress.total + ' done (' + progress.percent + '%)' : 'Nothing due';
    document.getElementById('room-progress-bar').hidden = isLaundry;
    setProgress('room-progress-bar', 'room-progress-fill', progress.percent);
    var lateNote = document.getElementById('laundry-late-note');
    var late = isLaundry ? W.overduePutAway(state.laundry, cw).length : 0;
    lateNote.hidden = !late;
    lateNote.textContent = late ? '⚠ ' + count(late, 'load', 'loads') + ' from an earlier week still to put away' : '';

    var content = document.getElementById('room-content');
    content.textContent = '';

    if (room.id === 'laundry') content.appendChild(renderLaundry());

    // Unfinished chores carry over automatically once their week ends.
    // Today's week: they're overdue. A future week: a preview of what's still
    // open (nothing changes until those weeks really end).
    if (selectedWeek === cw) {
      var overdue = S.overdueOccurrences(state, room.id, t);
      if (overdue.length) {
        var od = sectionBlock('Overdue', 'Unfinished chores from earlier weeks, including ones you skipped for now. They stay until you finish them.');
        od.classList.add('overdue-section');
        var odList = el('ul', 'item-list');
        overdue.forEach(function (o) { odList.appendChild(renderOccurrence(o)); });
        od.appendChild(odList);
        content.appendChild(od);
      }
    } else if (selectedWeek > cw) {
      var open = S.openBefore(state, room.id, selectedWeek, t);
      if (open.length) {
        var ob = sectionBlock('Still open now', 'Not done yet. If they\'re still open when ' + S.formatRangeShort(selectedWeek) +
          ' arrives, they\'ll be overdue then. Looking ahead doesn\'t change anything.');
        ob.classList.add('carry-preview');
        var obList = el('ul', 'item-list');
        open.forEach(function (o) { obList.appendChild(renderOccurrence(o)); });
        ob.appendChild(obList);
        content.appendChild(ob);
      }
    }

    // Chores due in the selected week.
    var title = 'Due ' + S.formatRangeShort(selectedWeek) + (selectedWeek === cw ? ' (this week)' : '');
    var due = sectionBlock(title);
    if (before) {
      due.appendChild(el('p', 'empty', 'This week is before room schedules started, so there is nothing to tick here.'));
    } else {
      // Chores moved out of this week are listed too (labelled "Moved to …"),
      // so they don't silently disappear. Each is still one occurrence.
      var movedAway = S.movedOut(state, room.id, selectedWeek, t).filter(function (o) { return o.status !== 'done'; });
      if (!occurrences.length && !movedAway.length) {
        due.appendChild(el('p', 'empty', 'No scheduled chores in this room this week.'));
      } else {
        var list = el('ul', 'item-list');
        occurrences.concat(movedAway).forEach(function (o) { list.appendChild(renderOccurrence(o)); });
        due.appendChild(list);
      }
    }
    content.appendChild(due);

    // As-needed chores are always available.
    var asNeeded = S.asNeededTasks(state, room.id);
    if (asNeeded.length) {
      var an = sectionBlock('As needed', 'Do these whenever they need it. They never become overdue.');
      var anList = el('ul', 'item-list');
      asNeeded.forEach(function (task) { anList.appendChild(renderAsNeeded(task)); });
      an.appendChild(anList);
      content.appendChild(an);
    }

    var add = sectionBlock('Add a chore');
    add.appendChild(renderTaskForm(null));
    content.appendChild(add);

    var manage = sectionBlock('All chores in this room', 'Edit names and schedules, or delete chores. Deleting keeps past completions in History.');
    manage.appendChild(renderManageList(room.id));
    content.appendChild(manage);
  }

  // ---------- Laundry ----------

  var NEXT_STEP = {
    waiting: ['wash', 'Start washing'],
    washer: ['dry', 'Move to dryer'],
    dryer: ['finish', 'Take out of dryer']
  };

  function stepButton(load, action, label, className) {
    var check = W.canMove(state.laundry, load, action);
    var btn = button('load', label, className, { load: load.id, step: action });
    if (!check.ok) {
      btn.disabled = true;
      btn.title = check.reason;
    }
    btn.setAttribute('aria-label', label + ': "' + load.name + '"' + (check.ok ? '' : ' (not available: ' + check.reason + ')'));
    return btn;
  }

  function renderSteps(load) {
    var steps = el('ol', 'steps');
    steps.setAttribute('aria-label', 'Step ' + (W.STAGES.indexOf(load.stage) + 1) + ' of 4: ' + W.STAGE_LABELS[load.stage]);
    W.STAGES.forEach(function (stage, i) {
      var item = el('li', i < W.STAGES.indexOf(load.stage) ? 'step past' : stage === load.stage ? 'step now' : 'step');
      item.textContent = W.STAGE_LABELS[stage];
      steps.appendChild(item);
    });
    return steps;
  }

  function renderLoad(load) {
    var li = el('li', 'load stage-' + load.stage);
    if (editingLoad === load.id) {
      var form = el('form', 'rename-form');
      form.dataset.load = load.id;
      var input = el('input');
      input.type = 'text';
      input.name = 'name';
      input.maxLength = 60;
      input.value = load.name;
      input.setAttribute('aria-label', 'Load name');
      form.appendChild(input);
      var save = el('button', 'btn btn-primary', 'Save');
      save.type = 'submit';
      form.appendChild(save);
      form.appendChild(button('cancel-rename', 'Cancel', 'btn-quiet'));
      li.appendChild(form);
      return li;
    }

    var head = el('div', 'load-head');
    head.appendChild(el('span', 'load-name', load.name));
    head.appendChild(el('span', 'badge', W.categoryName(state.laundry, load.categoryId)));
    li.appendChild(head);
    li.appendChild(renderSteps(load));
    var info = W.STAGE_LABELS[load.stage];
    if (load.stage === 'dryer' && load.dryCycles > 1) info += ' · drying cycle ' + load.dryCycles;
    if (load.stage === 'finished') info += ' ' + S.formatShort(load.finishedOn) + (load.putAway ? ' · put away' : ' · needs putting away');
    li.appendChild(el('p', 'load-info', info));
    if (load.stage === 'finished' && !load.putAway && load.finishedOn < laundryWeek()) {
      if (load.finishedOn < currentWeek()) {
        li.className += ' load-overdue';
        li.appendChild(el('p', 'badge status-overdue load-overdue-label', '⚠ Overdue · put away (finished ' + S.formatShort(load.finishedOn) + ')'));
      } else {
        li.appendChild(el('p', 'badge status-upcoming load-overdue-label', 'Not put away yet (finished ' + S.formatShort(load.finishedOn) + ')'));
      }
    }

    var actions = el('div', 'load-actions');
    if (NEXT_STEP[load.stage]) actions.appendChild(stepButton(load, NEXT_STEP[load.stage][0], NEXT_STEP[load.stage][1], 'btn-primary'));
    if (load.stage === 'finished') {
      var put = button('putaway', load.putAway ? 'Undo put away' : 'Mark put away', load.putAway ? 'btn-quiet' : 'btn-primary', { load: load.id });
      put.setAttribute('aria-label', (load.putAway ? 'Undo put away for "' : 'Mark put away: "') + load.name + '"');
      actions.appendChild(put);
    }
    if (load.stage === 'dryer' || load.stage === 'finished') actions.appendChild(stepButton(load, 'dryAgain', 'Dry again', 'btn-quiet'));
    if (load.stage !== 'waiting') actions.appendChild(stepButton(load, 'back', 'Back a step', 'btn-quiet'));
    var rename = button('rename-load', 'Rename', 'btn-small', { load: load.id });
    rename.setAttribute('aria-label', 'Rename "' + load.name + '"');
    var del = button('delete-load', 'Delete', 'btn-small btn-danger', { load: load.id });
    del.setAttribute('aria-label', 'Delete "' + load.name + '"');
    actions.appendChild(rename);
    actions.appendChild(del);
    li.appendChild(actions);

    var blocked = NEXT_STEP[load.stage] && W.canMove(state.laundry, load, NEXT_STEP[load.stage][0]);
    if (blocked && !blocked.ok) li.appendChild(el('p', 'load-blocked', blocked.reason + ' It can move when that machine is free.'));
    return li;
  }

  function renderLaundry() {
    var wrap = el('div', 'laundry');
    var c = W.counts(state.laundry);

    var board = sectionBlock('Laundry loads', 'One washer and one dryer. A load counts as finished once it\'s out of the dryer.');
    board.appendChild(el('p', 'hint counts-scope', 'On the board now. Started = in the washer, dryer, or finished. ' +
      'Moved to dryer = in the dryer or finished. Clearing put-away loads removes them from these counts; they stay in History.'));
    var stats = el('div', 'stats laundry-stats');
    [['Waiting', c.waiting], ['Started', c.started], ['Moved to dryer', c.movedToDryer], ['Finished', c.finished], ['To put away', c.needPutAway]]
      .forEach(function (s) {
        var tile = el('div', 'stat');
        tile.appendChild(el('span', 'stat-num', String(s[1])));
        tile.appendChild(el('span', 'stat-label', s[0]));
        stats.appendChild(tile);
      });
    board.appendChild(stats);
    var cw = currentWeek();
    var weekTotal = W.finishedBetween(state.laundry, cw, S.weekEnd(cw));
    board.appendChild(el('p', 'week-laundry-total', 'Finished this cleaning week: ' + count(weekTotal, 'load', 'loads') +
      ' (including loads already cleared from the board).'));

    var machines = el('div', 'machines');
    ['washer', 'dryer'].forEach(function (machine) {
      var load = W.occupant(state.laundry, machine);
      var box = el('div', 'machine' + (load ? ' busy' : ''));
      box.appendChild(el('span', 'machine-name', machine === 'washer' ? 'Washer' : 'Dryer'));
      box.appendChild(el('span', 'machine-state', load ? load.name : 'Free'));
      machines.appendChild(box);
    });
    board.appendChild(machines);

    var message = el('p', 'laundry-message', laundryMessage);
    message.setAttribute('role', 'status');
    board.appendChild(message);

    var form = el('form', 'load-form');
    var cat = el('select');
    cat.name = 'category';
    cat.setAttribute('aria-label', 'Laundry category');
    state.laundry.categories.forEach(function (category) {
      var option = el('option', '', category.name);
      option.value = category.id;
      cat.appendChild(option);
    });
    var name = el('input');
    name.type = 'text';
    name.name = 'name';
    name.maxLength = 60;
    name.placeholder = 'Name (optional)';
    name.setAttribute('aria-label', 'Load name (optional)');
    var add = el('button', 'btn btn-primary', 'Add load');
    add.type = 'submit';
    form.appendChild(cat);
    form.appendChild(name);
    form.appendChild(add);
    board.appendChild(form);

    state.laundry.categories.forEach(function (category) {
      var loads = state.laundry.loads.filter(function (l) { return l.categoryId === category.id && l.stage !== 'finished'; });
      board.appendChild(el('h4', 'category-title', category.name + ' (' + count(loads.length, 'load', 'loads') + ' in progress)'));
      var ul = el('ul', 'load-list');
      if (!loads.length) ul.appendChild(el('li', 'empty', 'No loads in progress.'));
      loads.forEach(function (load) { ul.appendChild(renderLoad(load)); });
      board.appendChild(ul);
    });
    wrap.appendChild(board);

    var late = W.overduePutAway(state.laundry, laundryWeek());
    var finished = state.laundry.loads.filter(function (l) { return l.stage === 'finished' && late.indexOf(l) === -1; });
    var put = sectionBlock('Put away laundry', 'Finished loads waiting to be folded and put away. Putting away doesn\'t change whether a load is finished.');
    if (late.length) {
      // Loads finished in an earlier week and still not put away: they stay
      // here, labelled with their week, until you mark them put away.
      put.appendChild(el('h4', 'category-title overdue-title', '⚠ From earlier weeks (' + late.length + ')'));
      var lateList = el('ul', 'load-list');
      late.forEach(function (load) { lateList.appendChild(renderLoad(load)); });
      put.appendChild(lateList);
      put.appendChild(el('h4', 'category-title', 'This week'));
    }
    var putList = el('ul', 'load-list');
    if (!finished.length) putList.appendChild(el('li', 'empty', late.length ? 'Nothing else to put away.' : 'No finished loads right now.'));
    finished.sort(function (a, b) { return Number(a.putAway) - Number(b.putAway); })
      .forEach(function (load) { putList.appendChild(renderLoad(load)); });
    put.appendChild(putList);
    if (finished.some(function (l) { return l.putAway; })) {
      put.appendChild(button('clear-putaway', 'Clear put-away loads', 'btn-quiet'));
    }
    wrap.appendChild(put);
    return wrap;
  }

  // ---------- Supplies (version 1.3: categories and notes) ----------

  var openSupplyCats = {}; // which categories you've opened or closed (screen only)
  var editingCategory = null; // id of the category being renamed
  var supplyTabMessage = null; // { text, kind, markId }

  function categorySelect(selectedId, label) {
    var select = el('select', 'category-select');
    select.name = 'category';
    select.setAttribute('aria-label', label || 'Category');
    state.supplyCategories.forEach(function (c) {
      var option = el('option', '', c.name);
      option.value = c.id;
      select.appendChild(option);
    });
    select.value = selectedId || SUP.OTHER;
    return select;
  }

  function renderSupplyItem(item) {
    var done = item.done;
    var li = el('li', 'item supply-item' + (done ? ' done' : ''));
    li.dataset.id = item.id;
    if (editing && editing.list === 'supplies' && editing.id === item.id) {
      var form = el('form', 'supply-edit-form');
      var name = el('input');
      name.type = 'text';
      name.name = 'name';
      name.maxLength = 80;
      name.value = item.name;
      name.setAttribute('aria-label', 'Supply name');
      var note = el('input');
      note.type = 'text';
      note.name = 'note';
      note.maxLength = 300;
      note.value = item.note || '';
      note.placeholder = 'Note (optional), e.g. brand or scent';
      note.setAttribute('aria-label', 'Note for this supply (optional)');
      form.appendChild(name);
      form.appendChild(note);
      form.appendChild(categorySelect(SUP.categoryOf(state, item), 'Move to category'));
      var save = el('button', 'btn btn-primary', 'Save Changes');
      save.type = 'submit';
      form.appendChild(save);
      form.appendChild(actionButton('cancel', 'Cancel', 'Cancel editing', 'btn-quiet'));
      li.appendChild(form);
      return li;
    }
    var check = el('button', 'check', done ? '✓' : '');
    check.type = 'button';
    check.dataset.action = 'toggle';
    check.setAttribute('aria-pressed', String(done));
    check.setAttribute('aria-label', 'Mark "' + item.name + '" as ' + (done ? 'needed' : 'stocked'));
    var body = el('div', 'item-body');
    body.appendChild(el('span', 'item-name', item.name));
    if (item.note) body.appendChild(el('span', 'supply-note', item.note));
    var actions = el('div', 'item-actions');
    actions.appendChild(actionButton('edit', 'Edit', 'Edit "' + item.name + '" (name, note, category)'));
    actions.appendChild(actionButton('delete', 'Delete', 'Delete "' + item.name + '"', 'btn-danger'));
    li.appendChild(check);
    li.appendChild(body);
    li.appendChild(actions);
    return li;
  }

  function renderCategoryTools(category, index, total) {
    var tools = el('div', 'category-tools');
    if (editingCategory === category.id) {
      var form = el('form', 'category-rename-form');
      form.dataset.cat = category.id;
      var input = el('input');
      input.type = 'text';
      input.name = 'name';
      input.maxLength = 40;
      input.value = category.name;
      input.setAttribute('aria-label', 'Category name');
      form.appendChild(input);
      var save = el('button', 'btn btn-primary btn-compact', 'Save');
      save.type = 'submit';
      form.appendChild(save);
      form.appendChild(button('cat-cancel', 'Cancel', 'btn-quiet btn-compact', { cat: category.id }));
      tools.appendChild(form);
      return tools;
    }
    var isOther = category.id === SUP.OTHER;
    var rename = button('cat-rename', 'Rename', 'btn-small', { cat: category.id });
    rename.setAttribute('aria-label', 'Rename category "' + category.name + '"');
    tools.appendChild(rename);
    if (!isOther) {
      var up = button('cat-up', '↑', 'btn-small', { cat: category.id });
      up.setAttribute('aria-label', 'Move "' + category.name + '" up');
      up.disabled = index === 0;
      var down = button('cat-down', '↓', 'btn-small', { cat: category.id });
      down.setAttribute('aria-label', 'Move "' + category.name + '" down');
      down.disabled = index >= total - 2; // "Other" stays last
      var del = button('cat-delete', 'Delete', 'btn-small btn-danger', { cat: category.id });
      del.setAttribute('aria-label', 'Delete category "' + category.name + '" (its supplies move to Other)');
      tools.appendChild(up);
      tools.appendChild(down);
      tools.appendChild(del);
    }
    return tools;
  }

  function renderSupplies() {
    var select = document.getElementById('add-supply-category');
    var chosen = select.value;
    select.textContent = '';
    state.supplyCategories.forEach(function (c) {
      var option = el('option', '', c.name);
      option.value = c.id;
      select.appendChild(option);
    });
    select.value = SUP.findCategory(state, chosen) ? chosen : SUP.OTHER;

    var msg = document.getElementById('supply-tab-msg');
    msg.textContent = '';
    if (supplyTabMessage) {
      msg.appendChild(el('p', 'supply-msg ' + supplyTabMessage.kind, supplyTabMessage.text));
      if (supplyTabMessage.markId) msg.appendChild(button('supply-mark-needed', 'Mark as needed', 'btn-quiet btn-compact', { id: supplyTabMessage.markId }));
    }

    var box = document.getElementById('list-supplies');
    box.textContent = '';
    var total = state.supplyCategories.length;
    state.supplyCategories.forEach(function (category, index) {
      var items = SUP.itemsIn(state, category.id);
      var c = SUP.counts(state, category.id);
      var details = el('details', 'supply-cat');
      details.dataset.cat = category.id;
      details.open = openSupplyCats[category.id] !== undefined ? openSupplyCats[category.id] : c.total > 0;
      var summary = el('summary', 'supply-cat-summary');
      summary.appendChild(el('span', 'supply-cat-name', category.name));
      summary.appendChild(el('span', 'supply-cat-count', c.total ? count(c.total, 'item', 'items') + (c.needed ? ' · ' + c.needed + ' needed' : '') : 'Empty'));
      details.appendChild(summary);
      var ul = el('ul', 'item-list');
      if (!items.length) ul.appendChild(el('li', 'empty', 'No supplies here yet.'));
      items.forEach(function (item) { ul.appendChild(renderSupplyItem(item)); });
      details.appendChild(ul);
      details.appendChild(renderCategoryTools(category, index, total));
      details.addEventListener('toggle', function () { openSupplyCats[category.id] = details.open; });
      box.appendChild(details);
    });
  }

  function onSuppliesClick(event) {
    var btn = event.target.closest('button[data-action]');
    if (!btn || btn.disabled) return;
    var d = btn.dataset;
    var li = btn.closest('li[data-id]');
    var item = li && SUP.findSupplyById(state, li.dataset.id);
    supplyTabMessage = null;
    switch (d.action) {
      case 'toggle':
        if (!item) return;
        L.toggleSupply(item);
        save();
        break;
      case 'edit':
        editing = { list: 'supplies', id: item.id };
        break;
      case 'cancel':
        editing = null;
        break;
      case 'delete':
        if (!item || !window.confirm('Delete "' + item.name + '"? Chores that mention it keep their supply link.')) return;
        state.supplies = state.supplies.filter(function (s) { return s.id !== item.id; });
        save();
        break;
      case 'cat-rename':
        editingCategory = d.cat;
        break;
      case 'cat-cancel':
        editingCategory = null;
        break;
      case 'cat-up':
      case 'cat-down':
        SUP.moveCategory(state, d.cat, d.action === 'cat-up' ? -1 : 1);
        save();
        break;
      case 'cat-delete':
        var category = SUP.findCategory(state, d.cat);
        if (!category || !window.confirm('Delete the category "' + category.name + '"? Its supplies move to Other; nothing is deleted.')) return;
        var moved = SUP.deleteCategory(state, d.cat);
        save();
        supplyTabMessage = { text: 'Category deleted.' + (moved ? ' ' + count(moved, 'supply', 'supplies') + ' moved to Other.' : ''), kind: 'success' };
        break;
      default:
        return;
    }
    render();
    if (d.action === 'edit' || d.action === 'cat-rename') {
      var input = document.querySelector('#list-supplies form input[type="text"]');
      if (input) input.focus();
    } else if (d.cat) {
      var again = document.querySelector('#list-supplies [data-action="' + d.action + '"][data-cat="' + d.cat + '"]');
      if (again && !again.disabled) again.focus();
    }
  }

  function onSuppliesSubmit(event) {
    var form = event.target;
    event.preventDefault();
    supplyTabMessage = null;
    if (form.classList.contains('supply-edit-form')) {
      var li = form.closest('li[data-id]');
      var item = li && SUP.findSupplyById(state, li.dataset.id);
      if (!item) return;
      var renamed = SUP.renameSupply(state, item.id, form.elements.name.value);
      if (!renamed.ok) {
        supplyTabMessage = { text: renamed.reason === 'exists' ? 'Another supply already has that name.' : 'Please enter a name.', kind: 'error' };
        render();
        return;
      }
      SUP.setNote(state, item.id, form.elements.note.value);
      SUP.moveSupply(state, item.id, form.elements.category.value);
      openSupplyCats[SUP.categoryOf(state, item)] = true;
      editing = null;
      save();
      supplyTabMessage = { text: '✓ Saved ' + item.name + '.' +
        (renamed.linksUpdated ? ' Updated ' + count(renamed.linksUpdated, 'chore link', 'chore links') + ' to the new name.' : ''), kind: 'success' };
    } else if (form.classList.contains('category-rename-form')) {
      if (!SUP.renameCategory(state, form.dataset.cat, form.elements.name.value)) {
        supplyTabMessage = { text: 'Please use a name that isn\'t blank or already used.', kind: 'error' };
        render();
        return;
      }
      editingCategory = null;
      save();
    }
    render();
  }

  function onSupplyAddSubmit(event) {
    event.preventDefault();
    var form = event.target;
    var result = SUP.addSupply(state, form.elements.name.value, form.elements.category.value);
    if (!result) {
      form.elements.name.focus();
      return;
    }
    if (result.action === 'exists') {
      var where = SUP.findCategory(state, SUP.categoryOf(state, result.supply)).name;
      supplyTabMessage = {
        text: '"' + result.supply.name + '" is already on your list (in ' + where + ')' + (result.supply.done ? ', ticked as stocked.' : ', marked as needed.'),
        kind: 'info',
        markId: result.supply.done ? result.supply.id : null
      };
    } else {
      save();
      openSupplyCats[SUP.categoryOf(state, result.supply)] = true;
      supplyTabMessage = { text: '✓ Added ' + result.supply.name + ' to ' + SUP.findCategory(state, SUP.categoryOf(state, result.supply)).name + '.', kind: 'success' };
      form.elements.name.value = '';
    }
    render();
    form.elements.name.focus();
  }

  function onSupplyTabMessageClick(event) {
    var btn = event.target.closest('[data-action="supply-mark-needed"]');
    if (!btn) return;
    var item = SUP.findSupplyById(state, btn.dataset.id);
    if (item) {
      item.done = false;
      save();
      supplyTabMessage = { text: '✓ Marked ' + item.name + ' as needed.', kind: 'success' };
      render();
    }
  }

  function onNewCategorySubmit(event) {
    event.preventDefault();
    var form = event.target;
    var category = SUP.addCategory(state, form.elements.name.value);
    if (!category) {
      supplyTabMessage = { text: 'Please use a category name that isn\'t blank or already used.', kind: 'error' };
    } else {
      save();
      openSupplyCats[category.id] = true;
      supplyTabMessage = { text: '✓ Added the category ' + category.name + '.', kind: 'success' };
      form.elements.name.value = '';
    }
    render();
  }

  // ---------- Cats (and the shared list code from version 1.1) ----------

  var LISTS = {
    pets: {
      isDone: function (item) { return L.isPetTaskDone(item, L.dayKey(new Date())); },
      toggle: function (item) { L.togglePetTask(item, L.dayKey(new Date())); },
      create: function (name) { return L.createPetTask(name); },
      empty: 'No cat tasks yet. Add one above.'
    }
  };

  function findItem(listName, id) {
    return state[listName].filter(function (item) { return item.id === id; })[0];
  }

  function renderItem(listName, item) {
    var config = LISTS[listName];
    var done = config.isDone(item);
    var li = el('li', 'item' + (done ? ' done' : ''));
    li.dataset.id = item.id;

    if (editing && editing.list === listName && editing.id === item.id) {
      li.appendChild(renderEditForm(item));
      return li;
    }

    var check = el('button', 'check', done ? '✓' : '');
    check.type = 'button';
    check.dataset.action = 'toggle';
    check.setAttribute('aria-pressed', String(done));
    check.setAttribute('aria-label', 'Mark "' + item.name + '" as ' + (done ? 'not done' : 'done'));

    var body = el('div', 'item-body');
    body.appendChild(el('span', 'item-name', item.name));

    var actions = el('div', 'item-actions');
    actions.appendChild(actionButton('edit', 'Edit', 'Edit "' + item.name + '"'));
    actions.appendChild(actionButton('delete', 'Delete', 'Delete "' + item.name + '"', 'btn-danger'));

    li.appendChild(check);
    li.appendChild(body);
    li.appendChild(actions);
    return li;
  }

  function renderEditForm(item) {
    var form = el('form', 'edit-form');
    form.dataset.action = 'save';
    var input = el('input');
    input.type = 'text';
    input.name = 'name';
    input.value = item.name;
    input.maxLength = 80;
    input.setAttribute('aria-label', 'Name');
    form.appendChild(input);
    var saveBtn = el('button', 'btn btn-primary', 'Save');
    saveBtn.type = 'submit';
    form.appendChild(saveBtn);
    form.appendChild(actionButton('cancel', 'Cancel', 'Cancel editing', 'btn-quiet'));
    return form;
  }

  function renderList(listName) {
    var ul = document.getElementById('list-' + listName);
    ul.textContent = '';
    if (state[listName].length === 0) {
      ul.appendChild(el('li', 'empty', LISTS[listName].empty));
      return;
    }
    state[listName].forEach(function (item) {
      ul.appendChild(renderItem(listName, item));
    });
  }

  // ---------- History ----------

  function formatDay(dayText) {
    var parts = dayText.split('-');
    var date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function historyLine(o) {
    // Completed under an older name? Show the name it had, and what it's called now.
    var then = o.record && o.record.name ? o.record.name : o.task.name;
    var text = then + (then !== o.task.name ? ' (now "' + o.task.name + '")' : '') + ' (' + roomName(o.task.room) + ')';
    if (o.status === 'done') {
      var late = o.record.completedOn > S.weekEnd(o.effectiveWeek);
      text += ' — done ' + S.formatShort(o.record.completedOn) + (late ? ' (late)' : '');
    }
    if (o.record && o.record.deferred && o.status !== 'done') text += ' — skipped for now';
    if (o.record && o.record.movedTo && o.record.movedTo !== o.week) text += ' — moved to the week of ' + S.formatShort(o.record.movedTo);
    if (o.record && o.record.note) text += ' — note: "' + o.record.note + '"';
    return text;
  }

  function detailsList(title, lines) {
    var wrap = el('div', 'history-group');
    wrap.appendChild(el('p', 'history-group-title', title));
    var ul = el('ul', 'history-lines');
    lines.forEach(function (line) { ul.appendChild(el('li', '', line)); });
    wrap.appendChild(ul);
    return wrap;
  }

  function renderHistory() {
    var ul = document.getElementById('list-history');
    ul.textContent = '';
    var t = today();
    var allLoads = state.laundry.loads.concat(state.laundry.archive);
    var weeks = [];
    for (var w = S.addWeeks(currentWeek(), -1); w >= state.activatedWeek && weeks.length < 52; w = S.addWeeks(w, -1)) weeks.push(w);
    if (!weeks.length) {
      ul.appendChild(el('li', 'empty', 'No past cleaning weeks yet. Check back after Friday!'));
      return;
    }
    weeks.forEach(function (week) {
      var h = S.weekHistory(state, week, t);
      var laundry = allLoads.filter(function (l) { return l.finishedOn && S.weekStart(l.finishedOn) === week; }).length;
      var li = el('li', 'card history-item');
      var head = el('div', 'history-head');
      head.appendChild(el('span', '', S.formatShort(week) + ' – ' + S.formatShort(S.weekEnd(week))));
      head.appendChild(el('span', '', h.done.length + ' done · ' + h.missed.length + ' missed' + (h.skipped.length ? ' · ' + h.skipped.length + ' dismissed' : '')));
      li.appendChild(head);
      if (state.reviews[week]) li.appendChild(el('span', 'chip chip-reviewed', '✓ Reviewed ' + S.formatShort(state.reviews[week].updatedOn)));
      var total = h.done.length + h.missed.length;
      li.appendChild(miniProgress(total ? Math.round((h.done.length / total) * 100) : 0));
      var details = el('details');
      details.appendChild(el('summary', '', 'Details'));
      if (h.done.length) details.appendChild(detailsList('Done', h.done.map(historyLine)));
      if (h.asNeeded.length) {
        details.appendChild(detailsList('As needed', h.asNeeded.map(function (e) {
          return e.name + ' (' + roomName(e.room) + ') — ' + S.formatShort(e.completedOn);
        })));
      }
      if (h.skipped.length) details.appendChild(detailsList('Skipped (dismissed in an older version)', h.skipped.map(historyLine)));
      if (h.missed.length) details.appendChild(detailsList('Missed (still overdue)', h.missed.map(historyLine)));
      details.appendChild(el('p', 'history-group-title', 'Laundry loads finished: ' + laundry));
      li.appendChild(details);
      ul.appendChild(li);
    });
  }

  function renderLegacy() {
    var sectionEl = document.getElementById('legacy-section');
    var legacy = state.legacy;
    sectionEl.hidden = !legacy;
    if (!legacy) return;
    document.getElementById('legacy-note').textContent = (legacy.note ? legacy.note + ' ' : '') +
      'Your weekly scores and chore list from version 1.1, archived on ' + formatDay(legacy.archivedOn) +
      '. Kept for reference only; nothing here is active.';
    var ul = document.getElementById('legacy-history');
    ul.textContent = '';
    Object.keys(legacy.history).sort().reverse().forEach(function (key) {
      var entry = legacy.history[key];
      var percent = entry.total === 0 ? 0 : Math.round((entry.done / entry.total) * 100);
      var li = el('li', 'card history-item legacy');
      var head = el('div', 'history-head');
      head.appendChild(el('span', '', 'Week of ' + formatDay(entry.weekStart)));
      head.appendChild(el('span', '', entry.done + ' / ' + entry.total + ' · ' + percent + '%'));
      li.appendChild(head);
      li.appendChild(miniProgress(percent));
      if (entry.completed.length) {
        var details = el('details');
        details.appendChild(el('summary', '', 'Completed chores'));
        details.appendChild(el('p', '', entry.completed.join(', ')));
        li.appendChild(details);
      }
      ul.appendChild(li);
    });
    if (legacy.chores.length) {
      var li = el('li', 'card history-item legacy');
      li.appendChild(el('div', 'history-head', 'Old chore list (no longer active)'));
      li.appendChild(el('p', '', legacy.chores.map(function (c) {
        return c.name + (c.recurring ? '' : ' (one-time)');
      }).join(', ')));
      ul.appendChild(li);
    }
  }

  // ---------- Add needed supply (checklist and week review) ----------

  // A message shown under one supply box after you tap Add: { box, text, kind }
  var supplyMessage = null;
  var SUPPLY_BUTTON = { add: 'Add to Supplies', mark: 'Mark as needed', already: 'Already needed' };

  // `box` names this supply box (one per chore occurrence, per screen).
  function renderSupplyAdder(task, box) {
    var wrap = el('div', 'supply-adder');
    wrap.dataset.box = box;
    wrap.appendChild(el('p', 'supply-adder-title', 'Add needed supply'));
    var suggestions = task.supplies || [];
    if (suggestions.length) {
      var suggested = el('div', 'supply-suggestions');
      suggested.appendChild(el('span', 'suggested-label', 'Suggested supplies:'));
      suggestions.forEach(function (name) {
        var chip = button('supply-suggest', name, 'btn-small btn-quiet', { box: box, name: name });
        chip.setAttribute('aria-label', 'Use suggestion: ' + name + ' (fills in the name below)');
        suggested.appendChild(chip);
      });
      wrap.appendChild(suggested);
    }
    var row = el('div', 'supply-row');
    var input = el('input');
    input.type = 'text';
    input.className = 'supply-name';
    input.maxLength = 80;
    input.placeholder = 'Supply name';
    input.dataset.box = box;
    input.setAttribute('aria-label', 'Supply needed for "' + task.name + '"');
    row.appendChild(input);
    // Optional: which Supplies category a NEW item goes in (default Other).
    row.appendChild(categorySelect(SUP.OTHER, 'Category for a new supply'));
    var add = button('supply-add', SUPPLY_BUTTON.add, 'btn-primary btn-compact', { box: box });
    add.disabled = true; // typing alone never adds anything
    row.appendChild(add);
    wrap.appendChild(row);
    var message = el('p', 'supply-msg', supplyMessage && supplyMessage.box === box ? supplyMessage.text : '');
    if (supplyMessage && supplyMessage.box === box) message.className += ' ' + supplyMessage.kind;
    message.setAttribute('role', 'status');
    wrap.appendChild(message);
    return wrap;
  }

  // Keeps the Add button's wording in step with the name typed.
  function updateSupplyButton(wrap) {
    var name = wrap.querySelector('.supply-name').value;
    var action = R.supplyAction(state, name);
    var add = wrap.querySelector('[data-action="supply-add"]');
    add.disabled = !action || action === 'already';
    add.textContent = SUPPLY_BUTTON[action || 'add'];
  }

  // Adds (or marks as needed) straight away, and says so. Save first, then switch.
  function addSupplyFromBox(wrap) {
    var name = wrap.querySelector('.supply-name').value;
    var updated = JSON.parse(JSON.stringify(state));
    var category = wrap.querySelector('.category-select');
    var result = P.addOrMarkSupply(updated, name, category ? category.value : null);
    if (!result || result.action === 'already') return;
    var storage = getStorage();
    if (storageMode !== 'ok' || !storage || !H.saveState(storage, updated)) {
      supplyMessage = { box: wrap.dataset.box, text: 'Couldn\'t save in this browser, so Supplies weren\'t changed.', kind: 'error' };
      render();
      return;
    }
    state = updated;
    if (reviewDraft && wrap.closest('#review-view')) reviewDraft.supplyChanges++;
    supplyMessage = {
      box: wrap.dataset.box,
      text: result.action === 'added' ? '✓ Added ' + result.name + ' to Supplies (unticked = needed).'
        : '✓ Marked ' + result.name + ' as needed on Supplies.',
      kind: 'success'
    };
    render();
  }

  // Shared click/typing handling for supply boxes anywhere on the page.
  function onSupplyClick(event) {
    var btn = event.target.closest('button[data-action^="supply-"]');
    if (!btn) return false;
    var wrap = btn.closest('.supply-adder');
    if (btn.dataset.action === 'supply-suggest') {
      wrap.querySelector('.supply-name').value = btn.dataset.name; // fills the box; you still tap Add
      updateSupplyButton(wrap);
      wrap.querySelector('[data-action="supply-add"]').focus();
    } else if (btn.dataset.action === 'supply-add') {
      var box = wrap.dataset.box;
      addSupplyFromBox(wrap);
      var again = document.querySelector('.supply-adder[data-box="' + box.replace(/"/g, '\\"') + '"] .supply-msg');
      if (again) again.focus();
    }
    return true;
  }

  function onSupplyInput(event) {
    if (!event.target.classList.contains('supply-name')) return false;
    updateSupplyButton(event.target.closest('.supply-adder'));
    return true;
  }

  // ---------- Finish Cleaning Week ----------

  var reviewDraft = null; // your choices while the review is open (not saved yet)
  var reviewStep = 'choose'; // 'choose' or 'summary'
  var reviewRoom = null; // room being reviewed, or 'all'
  var reviewError = '';
  var weekMessage = '';

  function renderReviewItem(o, alreadyDone) {
    var key = S.recordKey(o.task.id, o.week);
    var choice = reviewDraft.items[key];
    var li = el('li', 'review-item freq-' + o.task.frequency);
    li.dataset.key = key;
    var head = el('div', 'review-item-head');
    head.appendChild(el('span', 'review-item-name', o.task.name));
    var badges = el('span', 'badges');
    badges.appendChild(freqBadge(o.task.frequency));
    if (o.status === 'overdue') badges.appendChild(el('span', 'badge status-overdue', 'Overdue'));
    if (alreadyDone) badges.appendChild(el('span', 'badge status-done', '✓ Done ' + S.formatShort(o.record.completedOn) + ' via this review'));
    if (reviewRoom === 'all') badges.appendChild(el('span', 'badge', roomName(o.task.room)));
    head.appendChild(badges);
    li.appendChild(head);

    // Exactly two choices, as radio buttons.
    var group = el('fieldset', 'choice');
    group.appendChild(el('legend', 'visually-hidden', 'What to do with "' + o.task.name + '"'));
    [['carry', 'Carry Over'], ['done', 'Done']].forEach(function (c) {
      var label = el('label', 'choice-option');
      var radio = el('input');
      radio.type = 'radio';
      radio.name = 'choice-' + key;
      radio.value = c[0];
      radio.checked = choice.decision === c[0];
      radio.dataset.key = key;
      label.appendChild(radio);
      label.appendChild(document.createTextNode(' ' + c[1]));
      group.appendChild(label);
    });
    li.appendChild(group);

    if (choice.decision === 'carry') {
      var note = el('input');
      note.type = 'text';
      note.className = 'review-note';
      note.maxLength = 200;
      note.value = choice.note;
      note.placeholder = 'Note (optional)';
      note.dataset.key = key;
      note.setAttribute('aria-label', 'Note for "' + o.task.name + '" (optional)');
      li.appendChild(note);
      var supply = el('details', 'review-supply');
      supply.open = !!(supplyMessage && supplyMessage.box === 'review:' + key);
      supply.appendChild(el('summary', 'review-supply-summary', '+ Add needed supply'));
      supply.appendChild(renderSupplyAdder(o.task, 'review:' + key));
      li.appendChild(supply);
    }
    return li;
  }

  function renderReviewRooms(rooms, data) {
    var nav = el('div', 'review-rooms');
    nav.setAttribute('role', 'group');
    nav.setAttribute('aria-label', 'Choose a room to review');
    rooms.forEach(function (room) {
      var done = room.unfinished === 0;
      var label = (done ? '✓ ' : room.icon + ' ') + room.name + (done ? '' : ' · ' + room.unfinished);
      var b = button('review-room', label, 'room-pill' + (done ? ' room-pill-done' : ''), { room: room.id });
      b.setAttribute('aria-pressed', String(reviewRoom === room.id));
      b.setAttribute('aria-label', room.name + (done ? ', all done' : ', ' + count(room.unfinished, 'unfinished chore', 'unfinished chores')));
      nav.appendChild(b);
    });
    var all = button('review-room', 'All rooms · ' + data.unfinished, 'room-pill', { room: 'all' });
    all.setAttribute('aria-pressed', String(reviewRoom === 'all'));
    all.setAttribute('aria-label', 'All rooms, ' + count(data.unfinished, 'unfinished chore', 'unfinished chores'));
    nav.appendChild(all);
    return nav;
  }

  function renderReview() {
    var box = document.getElementById('review-view');
    box.textContent = '';
    var t = today();
    var data = R.reviewData(state, reviewDraft.week, t);

    var title = el('h2', '', 'Finish Cleaning Week');
    title.id = 'review-title';
    title.tabIndex = -1;
    box.appendChild(title);
    box.appendChild(el('p', 'review-range', S.formatWeekRange(reviewDraft.week) +
      (data.review ? ' · reviewed ' + S.formatShort(data.review.updatedOn) + ', you can change it' : '')));

    var stats = el('div', 'stats review-stats');
    [['Scheduled', data.scheduled], ['Completed', data.completed], ['Unfinished', data.unfinished]].forEach(function (s) {
      var tile = el('div', 'stat');
      tile.appendChild(el('span', 'stat-num', String(s[1])));
      tile.appendChild(el('span', 'stat-label', s[0]));
      stats.appendChild(tile);
    });
    box.appendChild(stats);
    if (reviewError) box.appendChild(el('p', 'backup-status error', reviewError));

    if (reviewStep === 'summary') {
      var counts = R.previewReview(state, reviewDraft, t);
      var summary = el('ul', 'review-summary');
      summary.setAttribute('aria-label', 'Review summary, all rooms');
      [
        count(counts.done, 'chore', 'chores') + ' marked Done',
        count(counts.carried, 'chore', 'chores') + ' carried over',
        count(counts.notes, 'note', 'notes') + ' added or updated',
        count(counts.supplies, 'supply', 'supplies') + ' added or marked as needed (already saved)'
      ].forEach(function (line) { summary.appendChild(el('li', '', line)); });
      box.appendChild(el('p', 'review-reviewing', 'Summary for all rooms'));
      box.appendChild(summary);
      box.appendChild(el('p', 'hint', 'Carried-over chores stay open and become overdue after this week, keeping their original due date.'));
      var confirmRow = el('div', 'backup-actions');
      confirmRow.appendChild(button('review-confirm', 'Confirm', 'btn-primary'));
      confirmRow.appendChild(button('review-back', 'Go Back', 'btn-quiet'));
      box.appendChild(confirmRow);
      return;
    }

    if (data.unfinished === 0) {
      box.appendChild(el('p', 'all-done', '✓ All done. Every chore scheduled this week is complete.'));
      if (data.reviewedDone.length) {
        var past = el('details', 'reviewed-done');
        past.appendChild(el('summary', '', 'Marked Done in this review (' + data.reviewedDone.length + ') · you can change these'));
        var pastList = el('ul', 'review-list');
        data.reviewedDone.forEach(function (o) { pastList.appendChild(renderReviewItem(o, true)); });
        past.appendChild(pastList);
        box.appendChild(past);
      }
    } else {
      var rooms = R.roomSummary(state, reviewDraft.week, t);
      if (!reviewRoom || (reviewRoom !== 'all' && !rooms.some(function (r) { return r.id === reviewRoom; }))) {
        var firstOpen = rooms.filter(function (r) { return r.unfinished > 0; })[0];
        reviewRoom = firstOpen ? firstOpen.id : 'all';
      }
      box.appendChild(renderReviewRooms(rooms, data));
      var inRoom = function (o) { return reviewRoom === 'all' || o.task.room === reviewRoom; };
      var current = rooms.filter(function (r) { return r.id === reviewRoom; })[0];
      box.appendChild(el('p', 'review-reviewing', 'Reviewing: ' + (reviewRoom === 'all' ? 'All rooms' : current.icon + ' ' + current.name)));
      box.appendChild(el('p', 'hint', 'Carry Over keeps a chore open (it becomes overdue after this week and keeps its due date). ' +
        'Done marks it complete today. Your choices are kept when you switch rooms.'));
      var unfinished = data.unfinishedItems.filter(inRoom);
      if (!unfinished.length) {
        box.appendChild(el('p', 'all-done', '✓ Everything in this room is done.'));
      } else {
        var ul = el('ul', 'review-list');
        unfinished.forEach(function (o) { ul.appendChild(renderReviewItem(o, false)); });
        box.appendChild(ul);
      }
      var reviewed = data.reviewedDone.filter(inRoom);
      if (reviewed.length) {
        var prev = el('details', 'reviewed-done');
        prev.appendChild(el('summary', '', 'Marked Done in this review (' + reviewed.length + ') · you can change these'));
        var prevList = el('ul', 'review-list');
        reviewed.forEach(function (o) { prevList.appendChild(renderReviewItem(o, true)); });
        prev.appendChild(prevList);
        box.appendChild(prev);
      }
    }
    var row = el('div', 'backup-actions');
    row.appendChild(button('review-next', 'Review summary', 'btn-primary'));
    row.appendChild(button('review-cancel', 'Cancel', 'btn-quiet'));
    box.appendChild(row);
  }

  function openReview() {
    reviewDraft = R.createDraft(state, selectedWeek, today());
    reviewStep = 'choose';
    reviewRoom = null;
    reviewError = '';
    weekMessage = '';
    supplyMessage = null;
    openRoom = null;
    render();
    document.getElementById('review-title').focus();
  }

  function closeReview() {
    reviewDraft = null;
    reviewError = '';
    supplyMessage = null;
    render();
    document.getElementById('finish-week').focus();
  }

  // Save first, then switch: the review only counts once it's really saved.
  function confirmReview() {
    var t = today();
    var updated = JSON.parse(JSON.stringify(state));
    var counts = R.applyReview(updated, reviewDraft, t);
    var storage = getStorage();
    if (storageMode !== 'ok' || !storage || !H.saveState(storage, updated)) {
      reviewError = 'The review could not be saved in this browser, so nothing was changed. Your choices are still here.';
      render();
      return;
    }
    state = updated;
    reviewDraft = null;
    reviewError = '';
    supplyMessage = null;
    weekMessage = '✓ Week reviewed: ' + count(counts.done, 'chore', 'chores') + ' done, ' +
      count(counts.carried, 'chore', 'chores') + ' carried over.';
    render();
    document.getElementById('finish-week').focus();
  }

  // Undo Week Review: removes only the review. Chores, dates, notes, and
  // supplies are untouched. Asks first; save first, then switch.
  function undoWeekReview() {
    var week = selectedWeek;
    if (!state.reviews[week]) return;
    if (!window.confirm('Undo the review for ' + S.formatRangeShort(week) + '? Your ticked chores, completion dates, notes, and supplies all stay as they are.')) return;
    var updated = JSON.parse(JSON.stringify(state));
    R.undoReview(updated, week);
    var storage = getStorage();
    if (storageMode !== 'ok' || !storage || !H.saveState(storage, updated)) {
      weekMessage = 'The review couldn\'t be undone because this browser couldn\'t save. Nothing was changed.';
      render();
      return;
    }
    state = updated;
    weekMessage = 'Review undone. Finish Cleaning Week is available again.';
    render();
    document.getElementById('finish-week').focus();
  }

  function onReviewClick(event) {
    if (onSupplyClick(event)) return;
    var btn = event.target.closest('button[data-action]');
    if (!btn) return;
    var d = btn.dataset;
    if (d.action === 'review-room') {
      reviewRoom = d.room;
      supplyMessage = null;
      render();
      var pill = document.querySelector('#review-view [data-action="review-room"][data-room="' + d.room + '"]');
      if (pill) pill.focus();
    } else if (d.action === 'review-next') {
      reviewStep = 'summary';
      render();
      var first = document.querySelector('#review-view [data-action="review-confirm"]');
      if (first) first.focus();
    } else if (d.action === 'review-back') {
      reviewStep = 'choose';
      render();
    } else if (d.action === 'review-cancel') {
      closeReview();
    } else if (d.action === 'review-confirm') {
      confirmReview();
    }
  }

  // Typing and choosing update the draft only; nothing is saved until Confirm.
  function onReviewInput(event) {
    if (onSupplyInput(event)) return;
    var target = event.target;
    var key = target.dataset.key;
    if (!key || !reviewDraft || !reviewDraft.items[key]) return;
    if (target.type === 'radio') {
      reviewDraft.items[key].decision = target.value;
      render();
      var again = document.querySelector('#review-view input[name="choice-' + key.replace(/"/g, '\\"') + '"][value="' + target.value + '"]');
      if (again) again.focus();
    } else if (target.classList.contains('review-note')) {
      reviewDraft.items[key].note = target.value;
    }
  }

  // ---------- Drawing everything ----------

  function render() {
    var cw = currentWeek();
    // When a new week starts while the app is open, follow it.
    if (shownCurrentWeek !== cw) {
      if (!selectedWeek || selectedWeek === shownCurrentWeek) selectedWeek = cw;
      shownCurrentWeek = cw;
    }
    renderWeek();
    var reviewing = !!reviewDraft;
    document.getElementById('review-view').hidden = !reviewing;
    document.getElementById('rooms-home').hidden = reviewing || !!openRoom;
    document.getElementById('room-view').hidden = reviewing || !openRoom;
    if (reviewing) {
      renderReview();
    } else if (openRoom) {
      renderRoomView();
    } else {
      renderHeadsUp();
      renderRoomGrid();
      renderPrep();
    }
    renderSupplies();
    renderList('pets');
    renderHistory();
    renderLegacy();
  }

  // After redrawing, put keyboard focus back on the same button.
  function refocus(dataset) {
    var selector = Object.keys(dataset).map(function (key) {
      var attr = key.replace(/[A-Z]/g, function (m) { return '-' + m.toLowerCase(); });
      return '[data-' + attr + '="' + String(dataset[key]).replace(/"/g, '\\"') + '"]';
    }).join('');
    var target = selector && document.querySelector('#room-content ' + selector);
    if (target && !target.disabled) target.focus();
  }

  // ---------- Responding to taps in a room ----------

  function onRoomClick(event) {
    if (onSupplyClick(event)) return;
    var btn = event.target.closest('button[data-action]');
    if (!btn || btn.disabled) return;
    supplyMessage = null;
    var d = btn.dataset;
    var t = today();
    var changed = true;
    laundryMessage = '';

    switch (d.action) {
      case 'toggle-done':
        S.toggleDone(state, d.task, d.week, t);
        break;
      case 'more':
        expanded = expanded === d.task + '|' + d.week ? null : d.task + '|' + d.week;
        changed = false;
        break;
      case 'skip-now':
        S.setDeferred(state, d.task, d.week, true); // stays unfinished
        break;
      case 'undo-skip-now':
        S.setDeferred(state, d.task, d.week, false); // also undoes a move made after skipping
        break;
      case 'undo-old-skip':
        S.toggleSkip(state, d.task, d.week); // reopens an older "dismissed" skip
        break;
      case 'save-note':
        S.setNote(state, d.task, d.week, btn.parentNode.querySelector('.note-input').value);
        break;
      case 'clear-note':
        S.setNote(state, d.task, d.week, '');
        break;
      case 'move':
        var select = btn.parentNode.querySelector('select');
        S.moveOccurrence(state, d.task, d.week, select.value, t);
        expanded = null;
        break;
      case 'asneeded-done':
        if (S.lastDone(state, d.task) === t) S.undoAsNeededToday(state, d.task, t);
        else S.markAsNeededDone(state, d.task, t);
        break;
      case 'edit-task':
        editingTask = d.task;
        editingFrom = null;
        changed = false;
        break;
      case 'edit-task-inline':
        editingTask = d.task;
        editingFrom = d.task + '|' + d.week;
        expanded = null;
        changed = false;
        break;
      case 'cancel-edit':
        editingTask = null;
        editingFrom = null;
        changed = false;
        break;
      case 'delete-task':
        var task = S.findTask(state, d.task);
        if (!task || !window.confirm('Delete "' + task.name + '" from ' + roomName(task.room) + '? Its past completions stay in History.')) return;
        S.deleteTask(state, d.task);
        break;
      case 'load':
        var result = W.moveLoad(state.laundry, d.load, d.step, t);
        if (!result.ok) {
          laundryMessage = result.reason;
          changed = false;
        }
        break;
      case 'putaway':
        W.togglePutAway(state.laundry, d.load, t);
        break;
      case 'rename-load':
        editingLoad = d.load;
        changed = false;
        break;
      case 'cancel-rename':
        editingLoad = null;
        changed = false;
        break;
      case 'delete-load':
        var load = W.findLoad(state.laundry, d.load);
        if (!load || !window.confirm('Delete the load "' + load.name + '"? This can\'t be undone.')) return;
        W.deleteLoad(state.laundry, d.load);
        break;
      case 'clear-putaway':
        if (!window.confirm('Clear put-away loads from the board? They stay in your history and backups.')) return;
        W.clearPutAway(state.laundry);
        break;
      default:
        return;
    }
    if (changed) save();
    var keep = {};
    Object.keys(d).forEach(function (k) { keep[k] = d[k]; });
    render();
    if (d.action === 'edit-task' || d.action === 'edit-task-inline' || d.action === 'rename-load') {
      var input = document.querySelector('#room-content .task-form[data-mode="edit"] input[name="name"], #room-content .rename-form input[type="text"]');
      if (input) input.focus();
    } else {
      refocus(keep);
    }
  }

  function onRoomSubmit(event) {
    var form = event.target;
    event.preventDefault();
    var t = today();
    if (form.classList.contains('task-form')) {
      var name = form.elements.name.value;
      var frequency = form.elements.frequency.value;
      var anchor = form.elements.anchor.value;
      var supplies = form.elements.supplies.value;
      if (form.dataset.mode === 'edit') {
        // A new schedule is a bigger change than a rename: ask first.
        var current = S.findTask(state, form.dataset.task);
        var newAnchor = frequency === 'biweekly' ? anchor : undefined;
        if (current && (current.frequency !== frequency || (frequency === 'biweekly' && current.anchor !== newAnchor)) &&
            !window.confirm('Change how often "' + current.name + '" repeats? The new schedule starts this week. Past completions stay as they are.')) {
          return;
        }
      }
      var ok = form.dataset.mode === 'edit'
        ? S.editTask(state, form.dataset.task, name, frequency, anchor, t, supplies)
        : S.addTask(state, openRoom, name, frequency, anchor, t, supplies);
      if (!ok) {
        form.elements.name.focus();
        return;
      }
      editingTask = null;
      editingFrom = null;
      save();
      render();
      if (form.dataset.mode === 'add') {
        var addInput = document.querySelector('#room-content .task-form[data-mode="add"] input[name="name"]');
        if (addInput) addInput.focus();
      }
    } else if (form.classList.contains('load-form')) {
      W.addLoad(state.laundry, form.elements.category.value, form.elements.name.value, t);
      laundryMessage = '';
      save();
      render();
    } else if (form.classList.contains('rename-form')) {
      if (!W.renameLoad(state.laundry, form.dataset.load, form.elements.name.value)) {
        form.elements.name.focus();
        return;
      }
      editingLoad = null;
      save();
      render();
    }
  }

  // Show the "which weeks" choice only for chores repeating every 2 weeks.
  function onRoomChange(event) {
    if (event.target.name === 'frequency') {
      var rotation = event.target.form.elements.anchor;
      rotation.hidden = event.target.value !== 'biweekly';
    }
  }

  function openRoomView(roomId) {
    openRoom = roomId;
    expanded = null;
    editingTask = null;
    editingLoad = null;
    laundryMessage = '';
    render();
    document.getElementById('back-to-rooms').focus();
    document.getElementById('panel-rooms').scrollIntoView();
  }

  function changeWeek(week) {
    selectedWeek = week;
    reviewDraft = null;
    weekMessage = '';
    expanded = null;
    render();
  }

  // ---------- Supplies and Cats taps (unchanged from version 1.1) ----------

  function onListClick(listName, event) {
    var btn = event.target.closest('button[data-action]');
    if (!btn) return;
    var li = btn.closest('li[data-id]');
    var item = li && findItem(listName, li.dataset.id);
    if (!item) return;

    var action = btn.dataset.action;
    if (action === 'toggle') {
      LISTS[listName].toggle(item);
      save();
    } else if (action === 'edit') {
      editing = { list: listName, id: item.id };
    } else if (action === 'cancel') {
      editing = null;
    } else if (action === 'delete') {
      if (!window.confirm('Delete "' + item.name + '"?')) return;
      state[listName] = state[listName].filter(function (x) { return x.id !== item.id; });
      save();
    }
    render();

    if (action === 'edit') {
      var input = document.querySelector('#list-' + listName + ' .edit-form input[type="text"]');
      if (input) input.focus();
    }
  }

  function onListSubmit(listName, event) {
    var form = event.target;
    if (form.dataset.action !== 'save') return;
    event.preventDefault();
    var li = form.closest('li[data-id]');
    var item = li && findItem(listName, li.dataset.id);
    var name = L.cleanName(form.elements.name.value);
    if (!item || !name) {
      form.elements.name.focus();
      return;
    }
    item.name = name;
    editing = null;
    save();
    render();
  }

  function onAddSubmit(event) {
    event.preventDefault();
    var form = event.target;
    var listName = form.dataset.list;
    var name = L.cleanName(form.elements.name.value);
    if (!name) {
      form.elements.name.focus();
      return;
    }
    state[listName].push(LISTS[listName].create(name, form));
    save();
    render();
    form.elements.name.value = '';
    form.elements.name.focus();
  }

  function showTab(tabName) {
    document.querySelectorAll('.tab').forEach(function (tab) {
      tab.setAttribute('aria-selected', String(tab.dataset.tab === tabName));
    });
    document.querySelectorAll('.panel').forEach(function (panel) {
      panel.hidden = panel.dataset.panel !== tabName;
    });
  }

  // ---------- Backup & Restore ----------

  var pendingRestore = null; // a checked backup waiting for "Replace my data"

  function setBackupStatus(message, kind) {
    var status = document.getElementById('backup-status');
    status.textContent = message;
    status.className = 'backup-status' + (kind ? ' ' + kind : '');
  }

  // Turns all saved data into a .json file and asks the browser to download it.
  // Asks the browser to download some text as a file.
  function downloadFile(fileName, text) {
    var blob = new Blob([text], { type: 'application/json' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(link.href); }, 10000);
  }

  function downloadBackup() {
    var now = new Date();
    downloadFile(L.backupFileName(now), JSON.stringify(H.createBackup(state, now), null, 2));
    setBackupStatus('Backup created: ' + L.backupFileName(now) +
      '. On iPad, you can find it in the Files app under Downloads.', 'success');
  }

  function hideRestoreConfirm() {
    pendingRestore = null;
    document.getElementById('restore-confirm').hidden = true;
  }

  function formatBackupDate(isoText) {
    var date = new Date(isoText);
    if (!isoText || isNaN(date.getTime())) return 'an unknown date';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function restoreSummary(s) {
    if (s.kind === 'v1') {
      var a = s.added;
      var text = 'This is a version 1.1 backup from ' + formatBackupDate(s.exportedAt) + '. Restoring it will:\n' +
        '• Replace your Supplies with its ' + count(s.supplies, 'item', 'items') + ' and your Cats list with its ' +
        count(s.pets, 'task', 'tasks') + '.\n' +
        '• Add ' + count(a.weeks, 'week', 'weeks') + ' of old chore history and ' + count(a.chores, 'old chore', 'old chores') +
        ' to History → Version 1.1 archive.\n';
      if (a.identicalWeeks || a.identicalChores) {
        text += '• Skip ' + count(a.identicalWeeks, 'week', 'weeks') + ' and ' + count(a.identicalChores, 'chore', 'chores') +
          ' that are already archived exactly as in the backup.\n';
      }
      if (a.conflictWeeks.length || a.conflictChores.length) {
        var parts = [];
        if (a.conflictWeeks.length) {
          parts.push(count(a.conflictWeeks.length, 'week', 'weeks') + ' (' + a.conflictWeeks.map(function (c) {
            return 'week of ' + formatDay(c.weekStart);
          }).join(', ') + ')');
        }
        if (a.conflictChores.length) {
          parts.push(count(a.conflictChores.length, 'chore', 'chores') + ' (' + a.conflictChores.map(function (c) {
            return '"' + c.archivedName + '"';
          }).join(', ') + ')');
        }
        text += '• Keep your archived version of ' + parts.join(' and ') +
          ', which differ in the backup. The backup\'s versions of those are not imported.\n';
      }
      return text + '• Keep your room chores, schedules, completion history, and laundry loads exactly as they are.';
    }
    return 'This backup is from ' + formatBackupDate(s.exportedAt) + ' and has ' +
      count(s.tasks, 'room chore', 'room chores') + ', ' + count(s.completions, 'completion', 'completions') + ', ' +
      count(s.loads, 'laundry load', 'laundry loads') + ', ' + count(s.supplies, 'supply', 'supplies') + ', ' +
      count(s.pets, 'cat-care task', 'cat-care tasks') + ', and ' +
      count(s.legacyWeeks, 'week', 'weeks') + ' of version 1.1 history.';
  }

  // Step 1 of restoring: read the chosen file and check it. Nothing is saved yet.
  function onBackupFileChosen(event) {
    var input = event.target;
    var file = input.files && input.files[0];
    input.value = ''; // so choosing the same file again still works
    hideRestoreConfirm();
    if (!file) return;

    var reader = new FileReader();
    reader.onload = function () {
      var text = String(reader.result);
      var result = H.validateBackup(text, today(), state);
      if (!result.ok) {
        setBackupStatus(result.error + ' Nothing was changed.', 'error');
        return;
      }
      pendingRestore = text; // checked again, against the latest data, when you confirm
      var merging = result.summary.kind === 'v1';
      document.getElementById('restore-title').textContent = merging ? 'Restore this older backup?' : 'Replace your current data?';
      document.getElementById('restore-summary').textContent = restoreSummary(result.summary);
      document.getElementById('restore-warning').textContent = merging
        ? 'Your current Supplies and Cats lists will be replaced. To keep a copy of them, tap Cancel and download a backup first.'
        : 'Restoring will replace everything currently saved in this browser, including laundry loads. ' +
          'To keep a copy, tap Cancel and download a backup first.';
      document.getElementById('confirm-restore').textContent = merging ? 'Restore older backup' : 'Replace my data';
      setBackupStatus('');
      document.getElementById('restore-confirm').hidden = false;
      document.getElementById('confirm-restore').focus();
    };
    reader.onerror = function () {
      setBackupStatus("That file couldn't be opened. Nothing was changed.", 'error');
    };
    reader.readAsText(file);
  }

  // Step 2 of restoring: only runs after tapping "Replace my data".
  function confirmRestore() {
    if (!pendingRestore) return;
    // Check again against the data as it is right now, so nothing you
    // changed while this box was open is lost.
    var result = H.validateBackup(pendingRestore, today(), state);
    if (!result.ok) {
      hideRestoreConfirm();
      setBackupStatus(result.error + ' Nothing was changed.', 'error');
      return;
    }
    hideRestoreConfirm();
    // Save FIRST. Only switch to the restored data if saving worked, so a
    // failure leaves both the screen and the saved data exactly as they were.
    var storage = getStorage();
    if (storageMode === 'unavailable' || !storage || !H.saveState(storage, result.state)) {
      setBackupStatus('The backup could not be saved in this browser (storage may be full, blocked, or unreadable). ' +
        'Nothing was changed: your previous data is still in place.', 'error');
      return;
    }
    state = result.state;
    storageMode = 'ok';
    reviewDraft = null;
    hideNotice();
    editing = null;
    editingTask = null;
    editingLoad = null;
    expanded = null;
    openRoom = null;
    selectedWeek = currentWeek();
    render();
    setBackupStatus('Your data was restored from the backup and saved.', 'success');
  }

  // ---------- Starting up ----------

  function start() {
    load();
    renderLegend();

    document.getElementById('download-backup').addEventListener('click', downloadBackup);
    document.getElementById('restore-file').addEventListener('change', onBackupFileChosen);
    document.getElementById('confirm-restore').addEventListener('click', confirmRestore);
    document.getElementById('cancel-restore').addEventListener('click', function () {
      hideRestoreConfirm();
      setBackupStatus('Restore cancelled. Nothing was changed.');
    });

    document.getElementById('app-notice-close').addEventListener('click', function () {
      document.getElementById('app-notice').hidden = true;
    });

    document.getElementById('prev-week').addEventListener('click', function () { changeWeek(S.addWeeks(selectedWeek, -1)); });
    document.getElementById('next-week').addEventListener('click', function () { changeWeek(S.addWeeks(selectedWeek, 1)); });
    document.getElementById('this-week').addEventListener('click', function () { changeWeek(currentWeek()); });

    document.getElementById('room-grid').addEventListener('click', function (e) {
      var card = e.target.closest('.room-card');
      if (card) openRoomView(card.dataset.room);
    });
    document.getElementById('back-to-rooms').addEventListener('click', function () {
      openRoom = null;
      render();
      var card = document.querySelector('.room-card[data-room]');
      if (card) card.focus();
    });

    var roomContent = document.getElementById('room-content');
    roomContent.addEventListener('click', onRoomClick);
    roomContent.addEventListener('submit', onRoomSubmit);
    roomContent.addEventListener('change', onRoomChange);
    roomContent.addEventListener('input', onSupplyInput);

    document.getElementById('prep-list').addEventListener('click', onPrepClick);

    document.getElementById('finish-week').addEventListener('click', openReview);
    document.getElementById('undo-review').addEventListener('click', undoWeekReview);
    var reviewView = document.getElementById('review-view');
    reviewView.addEventListener('click', onReviewClick);
    reviewView.addEventListener('change', onReviewInput);
    reviewView.addEventListener('input', onReviewInput);
    document.getElementById('prep-card').addEventListener('toggle', function () {
      // Remember your choice only when YOU open or close it.
      if (settingPrepOpen) settingPrepOpen = false;
      else prepOpenChoice = document.getElementById('prep-card').open;
    });

    ['pets'].forEach(function (listName) {
      var ul = document.getElementById('list-' + listName);
      ul.addEventListener('click', function (e) { onListClick(listName, e); });
      ul.addEventListener('submit', function (e) { onListSubmit(listName, e); });
    });

    document.querySelectorAll('.add-form[data-list]').forEach(function (form) {
      form.addEventListener('submit', onAddSubmit);
    });

    var suppliesBox = document.getElementById('list-supplies');
    suppliesBox.addEventListener('click', onSuppliesClick);
    suppliesBox.addEventListener('submit', onSuppliesSubmit);
    document.getElementById('supply-add-form').addEventListener('submit', onSupplyAddSubmit);
    document.getElementById('supply-tab-msg').addEventListener('click', onSupplyTabMessageClick);
    document.getElementById('new-category-form').addEventListener('submit', onNewCategorySubmit);

    document.querySelectorAll('.tab').forEach(function (tab) {
      tab.addEventListener('click', function () { showTab(tab.dataset.tab); });
    });

    document.getElementById('uncheck-supplies').addEventListener('click', function () {
      state.supplies.forEach(function (item) { item.done = false; });
      save();
      render();
    });

    // When you come back to the tab (e.g. next morning), refresh everything.
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) render();
    });

    render();
  }

  start();
})();
