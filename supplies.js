/*
 * supplies.js — Supplies categories and notes (version 1.3).
 *
 * Supplies stay simple: ticked = stocked, unticked = needed. There are no
 * quantities or stock levels. Version 1.3 only adds organisation:
 *  - state.supplyCategories: an ordered list of { id, name }.
 *  - supply.category (optional): which category it's in. A supply with no
 *    category, or one whose category no longer exists, shows in "Other".
 *    Existing supplies are never sorted into categories by guessing.
 *  - supply.note (optional): a short note, like a preferred brand.
 */
(function (global) {
  'use strict';

  var L = global.HouseholdLogic;
  var P = global.HouseholdPrep;

  var OTHER = 'other';

  var DEFAULT_CATEGORIES = [
    { id: 'cleaning', name: 'Cleaning Supplies' },
    { id: 'hair', name: 'Hair Care' },
    { id: 'body', name: 'Body Care' },
    { id: 'laundry', name: 'Laundry Supplies' },
    { id: 'cat', name: 'Cat Supplies' },
    { id: 'personal', name: 'Personal Care' },
    { id: OTHER, name: 'Other' }
  ];

  function defaultCategories() {
    return DEFAULT_CATEGORIES.map(function (c) { return { id: c.id, name: c.name }; });
  }

  function cleanName(text, max) {
    return String(text || '').replace(/\s+/g, ' ').trim().slice(0, max || 40);
  }

  function normal(text) {
    return cleanName(text, 200).toLowerCase();
  }

  function findCategory(state, id) {
    return state.supplyCategories.filter(function (c) { return c.id === id; })[0] || null;
  }

  function findSupplyById(state, id) {
    return state.supplies.filter(function (s) { return s.id === id; })[0] || null;
  }

  // The category a supply shows in ("other" when it has none, or a missing one).
  function categoryOf(state, supply) {
    return supply.category && findCategory(state, supply.category) ? supply.category : OTHER;
  }

  // Supplies in one category, in their saved order.
  function itemsIn(state, categoryId) {
    return state.supplies.filter(function (s) { return categoryOf(state, s) === categoryId; });
  }

  function counts(state, categoryId) {
    var items = itemsIn(state, categoryId);
    return { total: items.length, needed: items.filter(function (s) { return !s.done; }).length };
  }

  // ---------- Categories ----------

  function nameTaken(state, name, exceptId) {
    var key = normal(name);
    return state.supplyCategories.some(function (c) { return c.id !== exceptId && normal(c.name) === key; });
  }

  // Returns the new category, or null if the name is blank or already used.
  function addCategory(state, name) {
    var clean = cleanName(name);
    if (!clean || nameTaken(state, clean)) return null;
    var category = { id: 'c-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: clean };
    // New categories go just above "Other", which always stays last.
    var otherIndex = state.supplyCategories.map(function (c) { return c.id; }).indexOf(OTHER);
    state.supplyCategories.splice(otherIndex === -1 ? state.supplyCategories.length : otherIndex, 0, category);
    return category;
  }

  function renameCategory(state, id, name) {
    var category = findCategory(state, id);
    var clean = cleanName(name);
    if (!category || !clean || nameTaken(state, clean, id)) return false;
    category.name = clean;
    return true;
  }

  // Moves a category up (-1) or down (+1). "Other" stays at the bottom.
  function moveCategory(state, id, delta) {
    var list = state.supplyCategories;
    var from = list.map(function (c) { return c.id; }).indexOf(id);
    var to = from + delta;
    if (from === -1 || id === OTHER || to < 0 || to >= list.length || list[to].id === OTHER) return false;
    var moved = list.splice(from, 1)[0];
    list.splice(to, 0, moved);
    return true;
  }

  // Deletes a category. Its supplies move to "Other" (nothing is deleted).
  // "Other" itself can't be deleted. Returns how many supplies moved, or -1.
  function deleteCategory(state, id) {
    if (id === OTHER || !findCategory(state, id)) return -1;
    var moved = 0;
    state.supplies.forEach(function (s) {
      if (s.category === id) {
        delete s.category;
        moved++;
      }
    });
    state.supplyCategories = state.supplyCategories.filter(function (c) { return c.id !== id; });
    return moved;
  }

  // ---------- Supplies ----------

  function setCategory(supply, categoryId) {
    if (!categoryId || categoryId === OTHER) delete supply.category;
    else supply.category = categoryId;
  }

  // Adds a supply from the Supplies tab. If one with the same name already
  // exists (ignoring capitals and spaces), nothing is added:
  // { action: 'exists', supply }. Otherwise { action: 'added', supply }.
  function addSupply(state, name, categoryId, note) {
    var clean = L.cleanName(name);
    if (!clean) return null;
    var existing = P.findSupply(state, clean);
    if (existing) return { action: 'exists', supply: existing };
    var supply = L.createSupply(clean);
    if (categoryId && findCategory(state, categoryId)) setCategory(supply, categoryId);
    var cleanNote = cleanName(note, 300);
    if (cleanNote) supply.note = cleanNote;
    state.supplies.push(supply);
    return { action: 'added', supply: supply };
  }

  // Moves a supply to another category. It's the same record (same id, same
  // tick, same note), so nothing is duplicated.
  function moveSupply(state, supplyId, categoryId) {
    var supply = findSupplyById(state, supplyId);
    if (!supply || !findCategory(state, categoryId)) return false;
    setCategory(supply, categoryId);
    return true;
  }

  function setNote(state, supplyId, note) {
    var supply = findSupplyById(state, supplyId);
    if (!supply) return false;
    var clean = cleanName(note, 300);
    if (clean) supply.note = clean; else delete supply.note;
    return true;
  }

  // Renames a supply. Chores that list the old name are updated to the new
  // name, so their supply links aren't lost. Returns
  // { ok, linksUpdated } (ok is false for a blank name or a name in use).
  function renameSupply(state, supplyId, name) {
    var supply = findSupplyById(state, supplyId);
    var clean = L.cleanName(name);
    if (!supply || !clean) return { ok: false, linksUpdated: 0 };
    var other = P.findSupply(state, clean);
    if (other && other.id !== supplyId) return { ok: false, linksUpdated: 0, reason: 'exists' };
    var oldKey = normal(supply.name);
    var linksUpdated = 0;
    if (normal(clean) !== oldKey) {
      (state.tasks || []).forEach(function (task) {
        if (!task.supplies) return;
        task.supplies = task.supplies.map(function (n) {
          if (normal(n) !== oldKey) return n;
          linksUpdated++;
          return clean;
        });
      });
    }
    supply.name = clean;
    return { ok: true, linksUpdated: linksUpdated };
  }

  global.HouseholdSupplies = {
    OTHER: OTHER,
    DEFAULT_CATEGORIES: DEFAULT_CATEGORIES,
    defaultCategories: defaultCategories,
    findCategory: findCategory,
    findSupplyById: findSupplyById,
    categoryOf: categoryOf,
    itemsIn: itemsIn,
    counts: counts,
    addCategory: addCategory,
    renameCategory: renameCategory,
    moveCategory: moveCategory,
    deleteCategory: deleteCategory,
    addSupply: addSupply,
    moveSupply: moveSupply,
    setNote: setNote,
    renameSupply: renameSupply
  };
})(typeof window !== 'undefined' ? window : globalThis);
