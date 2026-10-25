/*
 * review.js — "Finish Cleaning Week" (version 1.2).
 *
 * An optional look back at one cleaning week. Each unfinished chore gets one
 * of two choices:
 *   Carry Over (default)  the occurrence stays open. Nothing about it changes:
 *                         it simply becomes overdue when its week ends, keeps
 *                         its original due date, and the schedule is untouched.
 *   Done                  the occurrence is marked done with today's date.
 * Carried-over chores can have a note and an optional "add needed supply".
 *
 * The review is saved in state.reviews[week] and can be reopened and edited
 * at any time. It never locks a week, clears the checklist, or moves time on.
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

  // What the review screen shows for one week. `items` are the chores you can
  // choose for: everything not done yet, plus anything this review itself
  // marked Done (so you can change your mind). Chores you ticked in the normal
  // checklist stay completed and aren't listed.
  function reviewData(state, week, today) {
    var review = state.reviews[week] || null;
    var scheduled = S.occurrencesForWeek(state, null, week, today).filter(function (o) { return o.status !== 'skipped'; });
    var completed = scheduled.filter(function (o) { return o.status === 'done'; });
    var items = scheduled.filter(function (o) {
      if (o.status !== 'done') return true;
      return !!review && review.decisions[S.recordKey(o.task.id, o.week)] === 'done';
    });
    return {
      week: week,
      review: review,
      scheduled: scheduled.length,
      completed: completed.length,
      unfinished: scheduled.length - completed.length,
      items: items
    };
  }

  // Your choices, before confirming. Carry Over is the default.
  function createDraft(state, week, today) {
    var items = {};
    reviewData(state, week, today).items.forEach(function (o) {
      items[S.recordKey(o.task.id, o.week)] = {
        decision: o.status === 'done' ? 'done' : 'carry',
        note: o.record && o.record.note ? o.record.note : '',
        supply: ''
      };
    });
    return { week: week, items: items };
  }

  // What tapping "Add needed supply" would do: 'add', 'mark', or null.
  function supplyAction(state, name) {
    var clean = String(name || '').trim();
    if (!clean) return null;
    return P.findSupply(state, clean) ? 'mark' : 'add';
  }

  // Applies the draft to `state` and saves the review. Returns the counts
  // shown in the summary. Run it on a copy first to preview the summary.
  function applyReview(state, draft, today) {
    var data = reviewData(state, draft.week, today);
    var decisions = {};
    var counts = { done: 0, carried: 0, notes: 0, supplies: 0 };
    var touchedSupplies = {};

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
      var result = P.addOrMarkSupply(state, choice.supply);
      if (result && !touchedSupplies[result.id]) {
        touchedSupplies[result.id] = true;
        counts.supplies++;
      }
    });

    var previous = state.reviews[draft.week];
    state.reviews[draft.week] = {
      reviewedOn: previous ? previous.reviewedOn : today,
      updatedOn: today,
      decisions: decisions,
      counts: counts
    };
    return counts;
  }

  // The summary numbers, worked out on a copy so nothing changes yet.
  function previewReview(state, draft, today) {
    return applyReview(JSON.parse(JSON.stringify(state)), draft, today);
  }

  global.HouseholdReview = {
    canReview: canReview,
    reviewData: reviewData,
    createDraft: createDraft,
    supplyAction: supplyAction,
    applyReview: applyReview,
    previewReview: previewReview
  };
})(typeof window !== 'undefined' ? window : globalThis);
