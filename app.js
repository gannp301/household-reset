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

  // "2 monthly · 1 every 2 weeks"
  function frequencyBreakdown(items) {
    var counts = {};
    items.forEach(function (i) { counts[i.task.frequency] = (counts[i.task.frequency] || 0) + 1; });
    return Object.keys(S.FREQUENCIES).filter(function (f) { return counts[f]; }).map(function (f) {
      return counts[f] + ' ' + S.FREQUENCIES[f].label.toLowerCase();
    }).join(' · ');
  }

  function headsUpText(group, relation) {
    var n = group.items.length;
    if (group.kind === 'overdue' && relation === 'current') {
      var oldest = group.items.reduce(function (min, i) { return i.week < min ? i.week : min; }, group.items[0].week);
      return [count(n, 'overdue chore', 'overdue chores'), 'From earlier weeks · oldest was due the week of ' + S.formatShort(oldest)];
    }
    if (group.kind === 'overdue') {
      return [count(n, 'chore', 'chores') + ' missed in this week', 'Still overdue · tick them from their rooms'];
    }
    if (group.kind === 'due') {
      return [count(n, 'less-frequent chore', 'less-frequent chores') + (relation === 'current' ? ' due this week' : ' due in this week'),
        frequencyBreakdown(group.items)];
    }
    return [count(n, 'monthly or quarterly chore', 'monthly or quarterly chores') + (relation === 'current' ? ' next week' : ' the week after'),
      'Week of ' + S.formatShort(group.week) + ' · ' + frequencyBreakdown(group.items)];
  }

  function headsUpItem(item, kind) {
    var li = el('li', 'hu-item');
    li.appendChild(el('span', 'hu-item-name', item.task.name));
    var badges = el('span', 'badges');
    badges.appendChild(el('span', 'badge', roomName(item.task.room)));
    badges.appendChild(freqBadge(item.task.frequency));
    if (kind === 'overdue') badges.appendChild(el('span', 'badge status-overdue', 'Due week of ' + S.formatShort(item.week)));
    else if (item.effectiveWeek !== item.week) badges.appendChild(el('span', 'badge status-moved', 'Moved from week of ' + S.formatShort(item.week)));
    li.appendChild(badges);
    return li;
  }

  // Follows the week selected in the navigator, and says which week that is.
  function renderHeadsUp() {
    var hu = S.headsUp(state, selectedWeek, today());
    var label = { current: 'this week', past: 'a past week', future: 'a future week' }[hu.relation];
    document.getElementById('heads-up-scope').textContent =
      'For the week shown above: ' + S.formatWeekRange(selectedWeek) + ' (' + label + ').';
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
      var text = headsUpText(group, hu.relation);
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

      var items = el('ul', 'hu-items');
      group.items.slice(0, 25).forEach(function (item) { items.appendChild(headsUpItem(item, group.kind)); });
      if (group.items.length > 25) items.appendChild(el('li', 'hint', 'and ' + (group.items.length - 25) + ' more'));
      details.appendChild(items);
      details.addEventListener('toggle', function () {
        openHeadsUp[group.kind] = details.open;
        toggle.textContent = details.open ? 'Hide details' : 'Show details';
      });
      li.appendChild(details);
      list.appendChild(li);
    });
    box.appendChild(list);
  }

  function laundrySummary() {
    var c = W.counts(state.laundry);
    var parts = [];
    if (c.waiting) parts.push(c.waiting + ' waiting');
    if (c.inWasher) parts.push('washing');
    if (c.inDryer) parts.push('drying');
    if (c.needPutAway) parts.push(c.needPutAway + ' to put away');
    return parts.length ? parts.join(' · ') : 'No loads in progress';
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
        meta = laundrySummary() + (progress.total ? ' · ' + progress.done + ' of ' + progress.total + ' chores' : '');
      } else if (before) {
        meta = 'Not tracked this week';
      } else {
        meta = progress.total ? progress.done + ' of ' + progress.total + ' done' : 'Nothing due this week';
      }
      card.appendChild(el('span', 'room-meta', meta));
      card.appendChild(miniProgress(progress.percent));
      if (overdue) card.appendChild(el('span', 'chip chip-overdue', '⚠ ' + overdue + ' overdue'));
      card.setAttribute('aria-label', room.name + ': ' + meta + (overdue ? ', ' + overdue + ' overdue' : ''));
      grid.appendChild(card);
    });
  }

  // ---------- Get ready for next week ----------

  var prepOpenChoice = null; // null = open automatically when something needs an answer
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
    if (action === 'prep-undo') {
      group.prompts.slice().reverse().forEach(function (p) { P.undoAnswer(state, p.key); });
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

  function statusBadges(o) {
    var badges = [];
    if (o.status === 'done') {
      var late = o.record.completedOn > S.weekEnd(o.effectiveWeek);
      badges.push(el('span', 'badge status-done', '✓ Done ' + S.formatShort(o.record.completedOn) + (late ? ' (late)' : '')));
    } else if (o.status === 'skipped') {
      badges.push(el('span', 'badge status-skipped', '⤼ Skipped'));
    } else if (o.status === 'overdue') {
      badges.push(el('span', 'badge status-overdue', '⚠ Overdue · due week of ' + S.formatShort(o.week)));
    } else if (o.status === 'upcoming') {
      badges.push(el('span', 'badge status-upcoming', '◷ Upcoming'));
    }
    if (o.effectiveWeek !== o.week && o.status !== 'overdue') {
      badges.push(el('span', 'badge status-moved', '→ Moved from week of ' + S.formatShort(o.week)));
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

    var check = button('toggle-done', done ? '✓' : '', 'check', data);
    check.className = 'check';
    check.setAttribute('aria-pressed', String(done));
    check.setAttribute('aria-label', 'Mark "' + o.task.name + '" as ' + (done ? 'not done' : 'done'));

    var body = el('div', 'item-body');
    body.appendChild(el('span', 'item-name', o.task.name));
    var badges = el('span', 'badges');
    badges.appendChild(freqBadge(o.task.frequency));
    statusBadges(o).forEach(function (b) { badges.appendChild(b); });
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
      actions.appendChild(button('skip', o.status === 'skipped' ? 'Undo skip' : 'Skip this week', 'btn-quiet', data));
      if (!done) {
        var moveWrap = el('div', 'move-wrap');
        moveWrap.appendChild(moveSelect(o));
        moveWrap.appendChild(button('move', 'Move', 'btn-quiet', data));
        actions.appendChild(moveWrap);
      }
      li.appendChild(actions);
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

    var submit = el('button', 'btn btn-primary', task ? 'Save' : 'Add');
    submit.type = 'submit';
    form.appendChild(submit);
    if (task) form.appendChild(button('cancel-edit', 'Cancel', 'btn-quiet'));
    if (task) form.appendChild(el('p', 'hint form-hint', 'Changing how often a chore repeats starts the new schedule from this week.'));
    return form;
  }

  function renderManageList(roomId) {
    var ul = el('ul', 'item-list');
    var tasks = state.tasks.filter(function (t) { return t.room === roomId; }).sort(function (a, b) {
      return S.FREQUENCIES[a.frequency].order - S.FREQUENCIES[b.frequency].order;
    });
    if (!tasks.length) ul.appendChild(el('li', 'empty', 'No chores in this room yet. Add one above.'));
    tasks.forEach(function (task) {
      var li = el('li', 'item manage-row freq-' + task.frequency);
      if (editingTask === task.id) {
        li.appendChild(renderTaskForm(task));
        ul.appendChild(li);
        return;
      }
      var body = el('div', 'item-body');
      body.appendChild(el('span', 'item-name', task.name));
      var badges = el('span', 'badges');
      badges.appendChild(freqBadge(task.frequency));
      var next = S.nextDueWeek(state, task, today());
      if (next) badges.appendChild(el('span', 'badge', 'Next due ' + S.formatShort(next)));
      if (task.supplies) badges.appendChild(el('span', 'badge', 'Needs: ' + task.supplies.join(', ')));
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
      ul.appendChild(li);
    });
    return ul;
  }

  function renderRoomView() {
    var room = S.roomById(openRoom);
    var t = today();
    var cw = currentWeek();
    var occurrences = S.occurrencesForWeek(state, room.id, selectedWeek, t);
    var progress = S.progressOf(occurrences);
    var before = selectedWeek < state.activatedWeek;

    document.getElementById('room-title').textContent = room.icon + ' ' + room.name;
    document.getElementById('room-progress-text').textContent = before ? 'Not tracked'
      : progress.total ? progress.done + ' of ' + progress.total + ' done (' + progress.percent + '%)' : 'Nothing due';
    setProgress('room-progress-bar', 'room-progress-fill', progress.percent);

    var content = document.getElementById('room-content');
    content.textContent = '';

    if (room.id === 'laundry') content.appendChild(renderLaundry());

    // Missed chores from earlier weeks (shown on the current week).
    var overdue = selectedWeek === cw ? S.overdueOccurrences(state, room.id, t) : [];
    if (overdue.length) {
      var od = sectionBlock('Overdue from earlier weeks', 'Missed chores stay here, with their original due week, until you do or skip them.');
      od.classList.add('overdue-section');
      var odList = el('ul', 'item-list');
      overdue.forEach(function (o) { odList.appendChild(renderOccurrence(o)); });
      od.appendChild(odList);
      od.appendChild(button('skip-all', 'Skip all overdue in this room', 'btn-quiet'));
      content.appendChild(od);
    }

    // Chores due in the selected week.
    var title = selectedWeek === cw ? 'Due this week' : 'Due in the week of ' + S.formatShort(selectedWeek);
    var due = sectionBlock(title);
    if (before) {
      due.appendChild(el('p', 'empty', 'This week is before room schedules started, so there is nothing to tick here.'));
    } else if (!occurrences.length) {
      due.appendChild(el('p', 'empty', 'No scheduled chores in this room this week.'));
    } else {
      var list = el('ul', 'item-list');
      occurrences.forEach(function (o) { list.appendChild(renderOccurrence(o)); });
      due.appendChild(list);
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

    var finished = state.laundry.loads.filter(function (l) { return l.stage === 'finished'; });
    var put = sectionBlock('Put away laundry', 'Finished loads waiting to be folded and put away. Putting away doesn\'t change whether a load is finished.');
    var putList = el('ul', 'load-list');
    if (!finished.length) putList.appendChild(el('li', 'empty', 'No finished loads right now.'));
    finished.sort(function (a, b) { return Number(a.putAway) - Number(b.putAway); })
      .forEach(function (load) { putList.appendChild(renderLoad(load)); });
    put.appendChild(putList);
    if (finished.some(function (l) { return l.putAway; })) {
      put.appendChild(button('clear-putaway', 'Clear put-away loads', 'btn-quiet'));
    }
    wrap.appendChild(put);
    return wrap;
  }

  // ---------- Supplies and Cats (the same lists as version 1.1) ----------

  var LISTS = {
    supplies: {
      isDone: function (item) { return item.done; },
      toggle: function (item) { L.toggleSupply(item); },
      create: function (name) { return L.createSupply(name); },
      empty: 'No supplies yet. Add one above.'
    },
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
    var text = o.task.name + ' (' + roomName(o.task.room) + ')';
    if (o.status === 'done') {
      var late = o.record.completedOn > S.weekEnd(o.effectiveWeek);
      text += ' — done ' + S.formatShort(o.record.completedOn) + (late ? ' (late)' : '');
    }
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
      head.appendChild(el('span', '', h.done.length + ' done · ' + h.skipped.length + ' skipped · ' + h.missed.length + ' missed'));
      li.appendChild(head);
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
      if (h.skipped.length) details.appendChild(detailsList('Skipped', h.skipped.map(historyLine)));
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

  // ---------- Drawing everything ----------

  function render() {
    var cw = currentWeek();
    // When a new week starts while the app is open, follow it.
    if (shownCurrentWeek !== cw) {
      if (!selectedWeek || selectedWeek === shownCurrentWeek) selectedWeek = cw;
      shownCurrentWeek = cw;
    }
    renderWeek();
    document.getElementById('rooms-home').hidden = !!openRoom;
    document.getElementById('room-view').hidden = !openRoom;
    if (openRoom) {
      renderRoomView();
    } else {
      renderHeadsUp();
      renderRoomGrid();
      renderPrep();
    }
    renderList('supplies');
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
    var btn = event.target.closest('button[data-action]');
    if (!btn || btn.disabled) return;
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
      case 'skip':
        S.toggleSkip(state, d.task, d.week);
        expanded = null;
        break;
      case 'move':
        var select = btn.parentNode.querySelector('select');
        S.moveOccurrence(state, d.task, d.week, select.value, t);
        expanded = null;
        break;
      case 'skip-all':
        if (!window.confirm('Skip every overdue chore in ' + roomName(openRoom) + '? They will be recorded as skipped, not done.')) return;
        S.skipAllOverdue(state, openRoom, t);
        break;
      case 'asneeded-done':
        if (S.lastDone(state, d.task) === t) S.undoAsNeededToday(state, d.task, t);
        else S.markAsNeededDone(state, d.task, t);
        break;
      case 'edit-task':
        editingTask = d.task;
        changed = false;
        break;
      case 'cancel-edit':
        editingTask = null;
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
    if (d.action === 'edit-task' || d.action === 'rename-load') {
      var input = document.querySelector('#room-content form input[type="text"]:not([placeholder="Add a chore…"])');
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
      var ok = form.dataset.mode === 'edit'
        ? S.editTask(state, form.dataset.task, name, frequency, anchor, t, supplies)
        : S.addTask(state, openRoom, name, frequency, anchor, t, supplies);
      if (!ok) {
        form.elements.name.focus();
        return;
      }
      editingTask = null;
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

    document.getElementById('prep-list').addEventListener('click', onPrepClick);
    document.getElementById('prep-card').addEventListener('toggle', function () {
      // Remember your choice only when YOU open or close it.
      if (settingPrepOpen) settingPrepOpen = false;
      else prepOpenChoice = document.getElementById('prep-card').open;
    });

    Object.keys(LISTS).forEach(function (listName) {
      var ul = document.getElementById('list-' + listName);
      ul.addEventListener('click', function (e) { onListClick(listName, e); });
      ul.addEventListener('submit', function (e) { onListSubmit(listName, e); });
    });

    document.querySelectorAll('.add-form').forEach(function (form) {
      form.addEventListener('submit', onAddSubmit);
    });

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
