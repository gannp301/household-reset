/*
 * review.js — "Finish Cleaning Week" (version 1.2).
 *
 * An optional look back at one cleaning week. Each unfinished chore gets one
 * of two choices:
 *   Carry Over (default)  the occurrence stays open. Nothing about it changes:
 *                         it simply becomes overdue when its week ends, keeps
 *                         its original due date, and the schedule is untouched.
 *   Done                  the occurrence is marked done with today's date.
 * Carried-over chores can have a note.
 *
 * Supplies: "Add to Supplies" during a review works IMMEDIATELY (the same as
 * in the normal checklist). The review only counts how many supplies you
 * changed while it was open (draft.supplyChanges); it doesn't add any itself.
 *
 * The review is saved in state.reviews[week]. It can be reopened and edited,
 * or undone (which removes only the review, never the chore records). It
 * never locks a week, clears the checklist, or moves time on.
 */
(function (global) {
  'use strict';

  var S = global.HouseholdSchedule;
  var P = global.HouseholdPrep;

  function cleanNote(text) {
    return String(text || '').replace(/\s+/g, ' ').trim().slice(0, 200);
  }

  // Only this week or earlier weeks (from when room schedules started).
  function canReview(state, week, today) {
    return week <= S.weekStart(today) && week >= state.activatedWeek;
  }

  // What the review screen shows for one week.
  //   unfinishedItems  chores not done yet (the "unfinished" count)
  //   reviewedDone     chores already completed BY an earlier save of this
  //                    review; listed separately so you can change your mind
  //   items            both lists together (everything you can choose for)
  // Chores ticked in the normal checklist stay completed and aren't listed.
  // scheduled = completed + unfinished, always.
  function reviewData(state, week, today) {
    var review = state.reviews[week] || null;
    var scheduled = S.occurrencesForWeek(state, null, week, today).filter(function (o) { return o.status !== 'skipped'; });
    var unfinishedItems = scheduled.filter(function (o) { return o.status !== 'done'; });
    var reviewedDone = scheduled.filter(function (o) {
      return o.status === 'done' && !!review && review.decisions[S.recordKey(o.task.id, o.week)] === 'done';
    });
    return {
      week: week,
      review: review,
      scheduled: scheduled.length,
      completed: scheduled.length - unfinishedItems.length,
      unfinished: unfinishedItems.length,
      unfinishedItems: unfinishedItems,
      reviewedDone: reviewedDone,
      items: unfinishedItems.concat(reviewedDone)
    };
  }

  // Per-room counts for the room selector (rooms with chores this week only).
  function roomSummary(state, week, today) {
    var data = reviewData(state, week, today);
    var rooms = [];
    S.ROOMS.forEach(function (room) {
      var unfinished = data.unfinishedItems.filter(function (o) { return o.task.room === room.id; }).length;
      var reviewed = data.reviewedDone.filter(function (o) { return o.task.room === room.id; }).length;
      var scheduled = S.occurrencesForWeek(state, room.id, week, today).filter(function (o) { return o.status !== 'skipped'; }).length;
      if (scheduled) rooms.push({ id: room.id, name: room.name, icon: room.icon, unfinished: unfinished, reviewedDone: reviewed, scheduled: scheduled });
    });
    return rooms;
  }

  // Your choices, before confirming. Carry Over is the default.
  function createDraft(state, week, today) {
    var items = {};
    reviewData(state, week, today).items.forEach(function (o) {
      items[S.recordKey(o.task.id, o.week)] = {
        decision: o.status === 'done' ? 'done' : 'carry',
        note: o.record && o.record.note ? o.record.note : ''
      };
    });
    return { week: week, items: items, supplyChanges: 0 };
  }

  // What the "Add to Supplies" button would do for a name:
  // 'add' (new), 'mark' (exists and is ticked), 'already' (exists, already
  // needed), or null (blank).
  function supplyAction(state, name) {
    var clean = String(name || '').trim();
    if (!clean) return null;
    var existing = P.findSupply(state, clean);
    if (!existing) return 'add';
    return existing.done ? 'mark' : 'already';
  }

  // Applies the draft to `state` and saves the review. Returns the counts
  // shown in the summary. Run it on a copy first to preview the summary.
  function applyReview(state, draft, today) {
    var data = reviewData(state, draft.week, today);
    var decisions = {};
    var counts = { done: 0, carried: 0, notes: 0, supplies: 0 };

    data.items.forEach(function (o) {
      var key = S.recordKey(o.task.id, o.week);
      var choice = draft.items[key];
      if (!choice) return;
      if (choice.decision === 'done') {
        decisions[key] = 'done';
        S.setDone(state, o.task.id, o.week, today);
        counts.done++;
        return;
      }
      decisions[key] = 'carry';
      counts.carried++;
      if (o.status === 'done') S.setOpen(state, o.task.id, o.week); // changing a Done from this review back to Carry Over
      var note = cleanNote(choice.note);
      var record = S.getRecord(state, o.task.id, o.week);
      if (note !== (record && record.note ? record.note : '')) {
        S.setNote(state, o.task.id, o.week, note);
        counts.notes++;
      }
    });
    counts.supplies = draft.supplyChanges || 0; // already saved when you tapped Add to Supplies

    var previous = state.reviews[draft.week];
    state.reviews[draft.week] = {
      reviewedOn: previous ? previous.reviewedOn : today,
      updatedOn: today,
      decisions: decisions,
      counts: counts
    };
    return counts;
  }

  // Undo Week Review: removes the review (its reviewed status and date) and
  // nothing else. Chore completions, dates, notes, and supplies all stay.
  function undoReview(state, week) {
    if (!state.reviews[week]) return false;
    delete state.reviews[week];
    return true;
  }

  // The summary numbers, worked out on a copy so nothing changes yet.
  function previewReview(state, draft, today) {
    return applyReview(JSON.parse(JSON.stringify(state)), draft, today);
  }

  global.HouseholdReview = {
    canReview: canReview,
    reviewData: reviewData,
    roomSummary: roomSummary,
    undoReview: undoReview,
    createDraft: createDraft,
    supplyAction: supplyAction,
    applyReview: applyReview,
    previewReview: previewReview
  };
})(typeof window !== 'undefined' ? window : globalThis);
