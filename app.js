/*
 * app.js — makes the page work.
 *
 * It draws the lists on screen, responds to taps, and saves everything
 * to localStorage. The rules (what "done this week" means, etc.) live in
 * logic.js, available here as HouseholdLogic.
 */
(function () {
  'use strict';

  var L = window.HouseholdLogic;
  var STORAGE_KEY = 'householdReset.v1';

  var state = null;
  var currentWeek = null;
  var editing = null; // which row is being edited: { list: 'chores', id: '...' }

  // ---------- Saving and loading ----------

  function load() {
    var text = null;
    try {
      text = window.localStorage.getItem(STORAGE_KEY);
    } catch (err) {
      showStorageWarning();
    }
    state = L.parseState(text);
    currentWeek = L.weekKey(new Date());
    L.rollover(state, new Date());
    save();
  }

  function save() {
    L.recordWeek(state, new Date());
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      showStorageWarning();
    }
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

  // If the app was left open past Sunday night, start the new week.
  function checkForNewWeek() {
    var week = L.weekKey(new Date());
    if (week !== currentWeek) {
      currentWeek = week;
      L.rollover(state, new Date());
      save();
    }
  }

  // ---------- The three checklists ----------

  // Each list has the same buttons; only the "done" rule differs.
  var LISTS = {
    chores: {
      isDone: function (item) { return L.isChoreDone(item, L.weekKey(new Date())); },
      toggle: function (item) { L.toggleChore(item, L.weekKey(new Date())); },
      create: function (name, form) { return L.createChore(name, form.elements.recurring.checked); },
      empty: 'No chores yet. Add one above.'
    },
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

  // Small helper to build an element: el('button', 'btn', 'Edit')
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text; // textContent keeps typed text safe
    return node;
  }

  function actionButton(action, label, ariaLabel, extraClass) {
    var btn = el('button', 'btn btn-small' + (extraClass ? ' ' + extraClass : ''), label);
    btn.type = 'button';
    btn.dataset.action = action;
    btn.setAttribute('aria-label', ariaLabel);
    return btn;
  }

  function renderItem(listName, item) {
    var config = LISTS[listName];
    var done = config.isDone(item);
    var li = el('li', 'item' + (done ? ' done' : ''));
    li.dataset.id = item.id;

    if (editing && editing.list === listName && editing.id === item.id) {
      li.appendChild(renderEditForm(listName, item));
      return li;
    }

    var check = el('button', 'check', done ? '✓' : '');
    check.type = 'button';
    check.dataset.action = 'toggle';
    check.setAttribute('aria-pressed', String(done));
    check.setAttribute('aria-label', 'Mark "' + item.name + '" as ' + (done ? 'not done' : 'done'));

    var body = el('div', 'item-body');
    body.appendChild(el('span', 'item-name', item.name));
    if (listName === 'chores') {
      body.appendChild(el('span', 'badge', item.recurring ? 'Weekly' : 'One-time'));
    }

    var actions = el('div', 'item-actions');
    actions.appendChild(actionButton('edit', 'Edit', 'Edit "' + item.name + '"'));
    actions.appendChild(actionButton('delete', 'Delete', 'Delete "' + item.name + '"', 'btn-danger'));

    li.appendChild(check);
    li.appendChild(body);
    li.appendChild(actions);
    return li;
  }

  function renderEditForm(listName, item) {
    var form = el('form', 'edit-form');
    form.dataset.action = 'save';

    var input = el('input');
    input.type = 'text';
    input.name = 'name';
    input.value = item.name;
    input.maxLength = 80;
    input.setAttribute('aria-label', 'Chore name');
    form.appendChild(input);

    if (listName === 'chores') {
      var label = el('label', 'toggle');
      var box = el('input');
      box.type = 'checkbox';
      box.name = 'recurring';
      box.checked = item.recurring;
      label.appendChild(box);
      label.appendChild(document.createTextNode(' Repeats weekly'));
      form.appendChild(label);
    }

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

  // ---------- Progress bar, header, and history ----------

  function formatDay(dayText) {
    var parts = dayText.split('-');
    var date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function renderProgress() {
    var progress = L.weeklyProgress(state.chores, L.weekKey(new Date()));
    document.getElementById('progress-count').textContent =
      progress.done + ' of ' + progress.total + ' done (' + progress.percent + '%)';
    document.getElementById('progress-fill').style.width = progress.percent + '%';
    document.getElementById('progress-bar').setAttribute('aria-valuenow', String(progress.percent));
    document.getElementById('week-label').textContent =
      'Week of ' + formatDay(L.weekStartDay(new Date()));
  }

  function renderHistory() {
    var ul = document.getElementById('list-history');
    ul.textContent = '';
    var weeks = L.pastWeeks(state, new Date());
    if (weeks.length === 0) {
      ul.appendChild(el('li', 'empty', 'No past weeks yet. Check back next week!'));
      return;
    }
    weeks.forEach(function (week) {
      var percent = week.total === 0 ? 0 : Math.round((week.done / week.total) * 100);
      var li = el('li', 'card history-item');

      var head = el('div', 'history-head');
      head.appendChild(el('span', '', 'Week of ' + formatDay(week.weekStart)));
      head.appendChild(el('span', '', week.done + ' / ' + week.total + ' · ' + percent + '%'));
      li.appendChild(head);

      var track = el('div', 'progress-track');
      var fill = el('div', 'progress-fill');
      fill.style.width = percent + '%';
      track.appendChild(fill);
      li.appendChild(track);

      if (week.completed.length) {
        var details = el('details');
        details.appendChild(el('summary', '', 'Completed chores'));
        details.appendChild(el('p', '', week.completed.join(', ')));
        li.appendChild(details);
      }
      ul.appendChild(li);
    });
  }

  function render() {
    checkForNewWeek();
    renderProgress();
    renderList('chores');
    renderList('supplies');
    renderList('pets');
    renderHistory();
  }

  // ---------- Responding to taps ----------

  function onListClick(listName, event) {
    var button = event.target.closest('button[data-action]');
    if (!button) return;
    var li = button.closest('li[data-id]');
    var item = li && findItem(listName, li.dataset.id);
    if (!item) return;

    var action = button.dataset.action;
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
    if (form.elements.recurring) item.recurring = form.elements.recurring.checked;
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
  function downloadBackup() {
    var now = new Date();
    var text = JSON.stringify(L.createBackup(state, now), null, 2);
    var blob = new Blob([text], { type: 'application/json' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = L.backupFileName(now);
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(link.href); }, 10000);
    setBackupStatus('Backup created: ' + link.download +
      '. On iPad, you can find it in the Files app under Downloads.', 'success');
  }

  function hideRestoreConfirm() {
    pendingRestore = null;
    document.getElementById('restore-confirm').hidden = true;
  }

  // count(1, 'week', 'weeks') -> "1 week"; count(3, 'week', 'weeks') -> "3 weeks"
  function count(n, one, many) {
    return n + ' ' + (n === 1 ? one : many);
  }

  function formatBackupDate(isoText) {
    var date = new Date(isoText);
    if (!isoText || isNaN(date.getTime())) return 'an unknown date';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
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
      var result = L.validateBackup(String(reader.result));
      if (!result.ok) {
        setBackupStatus(result.error + ' Nothing was changed.', 'error');
        return;
      }
      var s = result.summary;
      pendingRestore = result.state;
      document.getElementById('restore-summary').textContent =
        'This backup is from ' + formatBackupDate(s.exportedAt) + ' and has ' +
        count(s.chores, 'chore', 'chores') + ', ' + count(s.supplies, 'supply', 'supplies') + ', ' +
        count(s.pets, 'cat-care task', 'cat-care tasks') + ', and ' +
        count(s.weeks, 'week', 'weeks') + ' of history.';
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
    state = pendingRestore;
    editing = null;
    hideRestoreConfirm();
    // Apply this week's and today's resets to the restored lists.
    currentWeek = L.weekKey(new Date());
    L.rollover(state, new Date());
    save();
    render();
    setBackupStatus('Your data was restored from the backup.', 'success');
  }

  function start() {
    load();

    document.getElementById('download-backup').addEventListener('click', downloadBackup);
    document.getElementById('restore-file').addEventListener('change', onBackupFileChosen);
    document.getElementById('confirm-restore').addEventListener('click', confirmRestore);
    document.getElementById('cancel-restore').addEventListener('click', function () {
      hideRestoreConfirm();
      setBackupStatus('Restore cancelled. Nothing was changed.');
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

    // When you come back to the tab (e.g. next morning), refresh the lists.
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) render();
    });

    render();
  }

  start();
})();
