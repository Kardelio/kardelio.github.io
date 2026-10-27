// Live view of the scanned cards.
// Reads the "cards" collection without signing in (the Firestore rules allow public read, only the phone's
// user can write), and LISTENS to it: Firestore pushes every new card to this page the moment the app saves it, so there is
// no need to poll or refresh. Cards are ordered by document ID, which reads like
// 2026-10-25_10-41-11_0007_SOS-22 (run start, position in the run, card) and so sorts in scan order.
// The page shows the newest run first and, inside a run, the newest card first.

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import {
  getFirestore, collection, query, orderBy, documentId, onSnapshot,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const statusEl = document.getElementById("status");
const countEl = document.getElementById("count");
const uniqueEl = document.getElementById("unique");
const runsEl = document.getElementById("runs");
const messageEl = document.getElementById("message");
const loadingEl = document.getElementById("loading");
const hideLoading = () => { loadingEl.hidden = true; loadingEl.style.display = "none"; };
const spaceFilterEl = document.getElementById("spaceFilter");
const foilFilterEl = document.getElementById("foilFilter");
const searchEl = document.getElementById("search");
const zoomToggleEl = document.getElementById("zoomToggle");
const stackToggleEl = document.getElementById("stackToggle");
const runToggleEl = document.getElementById("runToggle");
const zoomEl = document.getElementById("zoom");
const zoomImgEl = zoomEl.querySelector("img");

const setButtonEl = document.getElementById("setButton");
const setPanelEl = document.getElementById("setPanel");
const setSearchEl = document.getElementById("setSearch");
const setListEl = document.getElementById("setList");
const setClearEl = document.getElementById("setClear");

// remembered in this browser (localStorage can be blocked, so every access is wrapped)
const prefs = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem("mtg." + key);
      return v === null ? fallback : JSON.parse(v);
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem("mtg." + key, JSON.stringify(value)); } catch { /* ignore */ }
  },
};
zoomToggleEl.checked = prefs.get("zoom", false) === true;
stackToggleEl.checked = prefs.get("stack", false) === true;
runToggleEl.checked = prefs.get("runs", false) === true;
let wantedSpace = String(prefs.get("space", ""));
foilFilterEl.value = ["foil", "normal"].includes(prefs.get("foil", "")) ? prefs.get("foil", "") : "";   // "" = all cards
const selectedSets = new Set(prefs.get("sets", []));   // set codes; empty = all sets
const cmcRangeEl = document.getElementById("cmcRange");
const cmcFillEl = document.getElementById("cmcFill");
const cmcLoThumb = document.getElementById("cmcLoThumb");
const cmcHiThumb = document.getElementById("cmcHiThumb");
const cmcLabelEl = document.getElementById("cmcLabel");
const pipEls = [...document.querySelectorAll("#colorPips .pip")];
const colorsOff = new Set(prefs.get("colorsOff", []));  // colours switched off: "W" "U" "B" "R" "G" "C" (colourless)
const rarityPipEls = [...document.querySelectorAll("#rarityPips .pip")];
const raritiesOff = new Set(prefs.get("raritiesOff", []));  // rarities switched off: "common" "uncommon" "rare" "mythic"
const sortButtonEl = document.getElementById("sortButton");
const sortPanelEl = document.getElementById("sortPanel");
const SORT_LABELS = { added: "Date added", name: "Name", cmc: "Mana value", rarity: "Rarity", color: "Colour", set: "Set", copies: "Copies" };
let sortKey = SORT_LABELS[prefs.get("sortKey", "")] ? prefs.get("sortKey", "") : "added";
let sortDir = prefs.get("sortDir", "desc") === "asc" ? "asc" : "desc";   // "added" + "desc" = newest first, the default
let cmcLo = Number(prefs.get("cmcLo", 0)) || 0;                 // lowest mana value shown
let cmcHi = prefs.get("cmcHi", null);                           // highest mana value shown; null = no upper limit
if (cmcHi !== null) cmcHi = Number(cmcHi);
let cmcExtent = 1;                                              // right end of the slider (grows with the collection, max 10)

let cards = [];                 // all cards, in scan order
const freshIds = new Set();     // cards that just arrived (they flash once)
let firstSnapshot = true;

function setStatus(text, kind) {
  statusEl.textContent = text;
  statusEl.className = kind || "";
}

function showMessage(text) {
  messageEl.textContent = text;
  messageEl.style.display = text ? "block" : "none";
}

// Foil (shiny) cards: the app saves isFoil = true / false. Older cards saved before the field existed have none,
// and count as not foil.
const isFoil = (c) => c.isFoil === true;

// The app stores the big PNG link; the "normal" JPG is much smaller and plenty for a grid.
function smallImage(url) {
  if (!url) return null;
  return url.replace("/png/", "/normal/").replace(/\.png(\?|$)/, ".jpg$1");
}

// The big "large" JPG (672 px wide) used by the hover zoom.
function largeImage(url) {
  if (!url) return null;
  return url.replace("/png/", "/large/").replace(/\.png(\?|$)/, ".jpg$1");
}

// ---- fuzzy search ----
// The query is split into words and EVERY word has to match a word of the card NAME:
//  - exactly (part of a word: "neg" -> "Negate"), or
//  - fuzzily, only for words of 4+ letters: the letters appear in order inside a name word
//    ("pstbd" -> "pestbrood"), or the word is only a typo or two away ("pestbrod", "hydro-chaneler").
// Short words (like "neg") are only ever matched exactly, otherwise they would match nearly everything.
// Sets and spaces are filtered with the Sets picker and the Space dropdown, not with the search.
const words = (text) => String(text || "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

function isSubsequence(small, big) {
  let i = 0;
  for (const ch of big) if (ch === small[i] && ++i === small.length) return true;
  return small.length === 0;
}

// number of single-letter edits between two words (stops early once it is above max)
function editDistance(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

function fuzzyNameMatch(token, word) {
  if (token.length < 4) return false;
  if (isSubsequence(token, word)) return true;
  const max = token.length >= 8 ? 2 : 1;
  // a typo in the whole word, or in the start of a longer word
  return editDistance(token, word, max) <= max || editDistance(token, word.slice(0, token.length), max) <= max;
}

function cardMatches(c, tokens) {
  const nameWords = words(c.name);
  return tokens.every((t) => nameWords.some((w) => w.includes(t) || fuzzyNameMatch(t, w)));
}

// the dropdown lists every collection space that appears on the saved cards
function refreshSpaceOptions() {
  const spaces = [...new Set(cards.map((c) => c.collectionSpace).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  spaceFilterEl.replaceChildren(new Option("All spaces", ""));
  for (const s of spaces) spaceFilterEl.append(new Option(s, s));
  spaceFilterEl.value = spaces.includes(wantedSpace) ? wantedSpace : "";
}

// ---- set picker: a small dropdown panel with a filter box and checkboxes ----
function renderSetPicker() {
  const sets = new Map();   // set code -> { name, count }
  for (const c of cards) {
    if (!c.setCode) continue;
    const entry = sets.get(c.setCode) || { name: c.setName || c.setCode, count: 0 };
    entry.count++;
    sets.set(c.setCode, entry);
  }
  const filter = setSearchEl.value.trim().toLowerCase();
  const rows = [...sets.entries()]
    .filter(([code, e]) => !filter || e.name.toLowerCase().includes(filter) || code.toLowerCase().includes(filter))
    .sort((a, b) => a[1].name.localeCompare(b[1].name));

  setListEl.replaceChildren();
  for (const [code, e] of rows) {
    const label = document.createElement("label");
    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = selectedSets.has(code);
    box.addEventListener("change", () => {
      if (box.checked) selectedSets.add(code); else selectedSets.delete(code);
      prefs.set("sets", [...selectedSets]);
      updateSetButton();
      render();
    });
    const name = document.createElement("span");
    name.className = "set-name";
    name.textContent = e.name;
    name.title = e.name;
    const meta = document.createElement("span");
    meta.className = "set-meta";
    meta.textContent = `${code.toUpperCase()} · ${e.count}`;
    label.append(box, name, meta);
    setListEl.append(label);
  }
  if (!rows.length) {
    const none = document.createElement("div");
    none.className = "none";
    none.textContent = "No sets found";
    setListEl.append(none);
  }
  updateSetButton();
}

function updateSetButton() {
  const n = selectedSets.size;
  setButtonEl.textContent = (n ? `${n} set${n === 1 ? "" : "s"}` : "All sets") + " \u25BE";
  setButtonEl.classList.toggle("active", n > 0);
}

// A card is shown when EVERY colour of its colour identity is switched on; a colourless card needs "C" on.
function colorAllowed(c) {
  const identity = c.colorIdentity || [];
  if (!identity.length) return !colorsOff.has("C");
  return identity.every((color) => !colorsOff.has(color));
}

function rarityAllowed(c) {
  return !raritiesOff.has(String(c.rarity || "").toLowerCase());
}

function render() {
  hideZoom();   // the cards are redrawn, so a popup for an old card element must go
  const wanted = spaceFilterEl.value;
  const tokens = searchEl.value.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  let shown = wanted ? cards.filter((c) => c.collectionSpace === wanted) : cards;
  if (foilFilterEl.value) shown = shown.filter((c) => isFoil(c) === (foilFilterEl.value === "foil"));
  const [lo, hi] = cmcBounds();
  if (lo > 0 || cmcHi !== null) {
    shown = shown.filter((c) => {
      const v = c.cmc ?? 0;
      return v >= lo && (cmcHi === null || v <= hi);   // both ends inclusive
    });
  }
  if (colorsOff.size) shown = shown.filter(colorAllowed);
  if (raritiesOff.size) shown = shown.filter(rarityAllowed);
  if (selectedSets.size) shown = shown.filter((c) => selectedSets.has(c.setCode));
  if (tokens.length) shown = shown.filter((c) => cardMatches(c, tokens));
  const stacks = stackCards(shown);   // one entry per different card (same printing = same card)
  countEl.textContent = shown.length === cards.length ? cards.length : `${shown.length} of ${cards.length}`;
  uniqueEl.textContent = stacks.length;
  runsEl.replaceChildren();

  // newest card first; with "Stack dupes" copies of the same card share one tile
  const stacked = stackToggleEl.checked;
  const tilesOf = (list) => sortTiles(stacked ? stackCards(list) : list.slice().reverse().map((c) => [c]));
  const fillGrid = (list) => {
    const grid = document.createElement("div");
    grid.className = "grid";
    for (const copies of tilesOf(list)) grid.append(buildCard(copies[copies.length - 1], copies, stacked));
    return grid;
  };

  if (!runToggleEl.checked) {
    runsEl.append(fillGrid(shown));
    return;
  }
  // "Group by run": a heading per scanning run, newest run first
  const byRun = new Map();
  for (const c of shown) {
    const key = runKey(c);
    if (!byRun.has(key)) byRun.set(key, []);
    byRun.get(key).push(c);
  }
  for (const key of [...byRun.keys()].sort().reverse()) {
    const list = byRun.get(key);
    const head = document.createElement("div");
    head.className = "run-head";
    const title = document.createElement("span");
    title.className = "run-title";
    title.textContent = runLabel(key);
    const meta = document.createElement("span");
    meta.className = "run-meta";
    meta.textContent = `${list.length} ${list.length === 1 ? "card" : "cards"}`;
    head.append(title, meta);
    runsEl.append(head, fillGrid(list));
  }
}

// A card's run is the start time at the front of its document ID: 2026-10-25_10-41-11_0007_SOS-22 -> 2026-10-25_10-41-11
function runKey(c) {
  const m = /^(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})_/.exec(c.id);
  return m ? m[1] : "";
}

function runLabel(key) {
  if (!key) return "Unknown run";
  const [d, t] = key.split("_");
  const [y, mo, day] = d.split("-").map(Number);
  const [h, mi] = t.split("-").map(Number);
  return new Date(y, mo - 1, day, h, mi).toLocaleString(undefined, {
    weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

const RARITY_RANK = { common: 0, uncommon: 1, rare: 2, mythic: 3 };
const COLOR_ORDER = ["W", "U", "B", "R", "G"];

// Mono colours in WUBRG order, then multicolour, then colourless.
function colorRank(c) {
  const identity = c.colorIdentity || [];
  if (!identity.length) return 6;
  return identity.length > 1 ? 5 : COLOR_ORDER.indexOf(identity[0]);
}

function compareBy(key, a, b) {   // a, b: the newest card of a tile
  switch (key) {
    case "name": return (a.name ?? "").localeCompare(b.name ?? "");
    case "cmc": return (a.cmc ?? 0) - (b.cmc ?? 0);
    case "rarity": return (RARITY_RANK[String(a.rarity).toLowerCase()] ?? -1) - (RARITY_RANK[String(b.rarity).toLowerCase()] ?? -1);
    case "color": return colorRank(a) - colorRank(b);
    case "set": return (a.setName ?? a.setCode ?? "").localeCompare(b.setName ?? b.setCode ?? "")
      || (parseInt(a.collectorNumber, 10) || 0) - (parseInt(b.collectorNumber, 10) || 0);
    default: return 0;
  }
}

// `tiles` arrives newest first. "Date added" just keeps or flips that order; other keys sort with name as the tie-break.
function sortTiles(tiles) {
  if (sortKey === "added") return sortDir === "desc" ? tiles : tiles.slice().reverse();
  const sign = sortDir === "asc" ? 1 : -1;
  const order = new Map(tiles.map((t, i) => [t, i]));
  return tiles.slice().sort((x, y) => {
    const a = x[x.length - 1], b = y[y.length - 1];
    const d = sortKey === "copies" ? x.length - y.length : compareBy(sortKey, a, b);
    return sign * d || (a.name ?? "").localeCompare(b.name ?? "") || order.get(x) - order.get(y);
  });
}

// Same printing (same Scryfall card) = same stack. Newest copy first, so a freshly scanned card moves to the top.
function stackCards(list) {
  const groups = new Map();
  for (const c of list) {   // list is in scan order, so the last copy of a group is its newest
    // a foil copy and a normal copy of the same printing are different tiles
    const key = (c.scryfallId || `${c.setCode}-${c.collectorNumber}`) + (isFoil(c) ? "|foil" : "");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }
  return [...groups.values()].sort((a, b) => (a[a.length - 1].id < b[b.length - 1].id ? 1 : -1));
}

// One card tile. `copies` holds every copy that this tile stands for (just [c] when not stacking).
function buildCard(c, copies, stacked) {
  const card = document.createElement("div");
  card.className = "card" + (freshIds.has(c.id) ? " fresh" : "") + (isFoil(c) ? " foil" : "");

  const src = smallImage(c.imageUri);
  if (src) {
    const img = document.createElement("img");
    img.loading = "lazy";
    img.alt = c.name || "";
    img.src = src;
    card.dataset.large = largeImage(c.imageUri);
    card.append(img);
  } else {
    const none = document.createElement("div");
    none.className = "noimg";
    none.textContent = "no image";
    card.append(none);
  }
  if (isFoil(c)) {
    const star = document.createElement("div");
    star.className = "foilmark";
    star.textContent = "\u2605";
    star.title = "Foil";
    card.append(star);
  }
  if (copies.length > 1) {
    const badge = document.createElement("div");
    badge.className = "badge";
    badge.textContent = `\u00D7${copies.length}`;
    badge.title = `${copies.length} copies`;
    card.append(badge);
  }

  const info = document.createElement("div");
  info.className = "info";
  const name = document.createElement("div");
  name.className = "name";
  name.title = c.name || "";
  name.textContent = stacked ? (c.name ?? "") : `#${c.scanNumber ?? "?"}  ${c.name ?? ""}`;
  const meta = document.createElement("div");
  meta.className = "meta";
  meta.textContent = `${isFoil(c) ? "\u2605 Foil \u00B7 " : ""}${c.setCode ?? ""} ${c.collectorNumber ?? ""}${c.setName ? " - " + c.setName : ""}`;
  info.append(name, meta);
  const spaces = [...new Set(copies.map((x) => x.collectionSpace).filter(Boolean))];
  if (spaces.length) {
    const space = document.createElement("div");
    space.className = "space";
    space.textContent = spaces.join(", ");
    space.title = spaces.length > 1 ? "Collection spaces" : "Collection space";
    info.append(space);
  }
  card.append(info);
  return card;
}

runToggleEl.addEventListener("change", () => { prefs.set("runs", runToggleEl.checked); render(); });
stackToggleEl.addEventListener("change", () => { prefs.set("stack", stackToggleEl.checked); render(); });
foilFilterEl.addEventListener("change", () => { prefs.set("foil", foilFilterEl.value); render(); });
spaceFilterEl.addEventListener("change", () => { wantedSpace = spaceFilterEl.value; prefs.set("space", wantedSpace); render(); });

setButtonEl.addEventListener("click", () => {
  setPanelEl.hidden = !setPanelEl.hidden;
  if (!setPanelEl.hidden) sortPanelEl.hidden = true;
  if (!setPanelEl.hidden) setSearchEl.focus();
});
setSearchEl.addEventListener("input", renderSetPicker);
setClearEl.addEventListener("click", () => {
  selectedSets.clear();
  prefs.set("sets", []);
  renderSetPicker();
  render();
});
document.addEventListener("click", (e) => { if (!e.target.closest("#setPicker")) setPanelEl.hidden = true; });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") setPanelEl.hidden = true; });
updateSetButton();
let searchTimer;
searchEl.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(render, 120);
});

// ---- mana value range slider (two handles) ----
function cmcBounds() {
  const hi = cmcHi === null ? cmcExtent : Math.min(cmcHi, cmcExtent);
  return [Math.min(cmcLo, hi), hi];
}

function drawCmcRange() {
  const [lo, hi] = cmcBounds();
  const at = (v) => `calc(${v / cmcExtent} * (100% - 16px))`;   // left edge of a handle at value v
  cmcLoThumb.style.left = at(lo);
  cmcHiThumb.style.left = at(hi);
  cmcFillEl.style.left = `calc(${at(lo)} + 8px)`;
  cmcFillEl.style.right = `calc((1 - ${hi / cmcExtent}) * (100% - 16px) + 8px)`;
  for (const [thumb, v] of [[cmcLoThumb, lo], [cmcHiThumb, hi]]) {
    thumb.setAttribute("aria-valuemin", "0");
    thumb.setAttribute("aria-valuemax", String(cmcExtent));
    thumb.setAttribute("aria-valuenow", String(v));
  }
  const noUpper = cmcHi === null;
  cmcLabelEl.textContent = noUpper ? (lo === 0 ? "Any" : `${lo}+`) : (lo === hi ? `${lo}` : `${lo} - ${hi}`);
}

// the slider reaches the highest mana value in the collection (at most 10, where the top end means "10 or more")
function updateCmcExtent() {
  const top = cards.reduce((m, c) => Math.max(m, Math.ceil(c.cmc || 0)), 0);
  cmcExtent = Math.min(10, Math.max(1, top));
  drawCmcRange();
}

function setCmc(which, value) {
  const [lo, hi] = cmcBounds();
  if (which === "lo") cmcLo = Math.max(0, Math.min(value, hi));
  else cmcHi = Math.min(cmcExtent, Math.max(value, lo)) >= cmcExtent ? null : Math.min(cmcExtent, Math.max(value, lo));
  prefs.set("cmcLo", cmcLo);
  prefs.set("cmcHi", cmcHi);
  drawCmcRange();
  clearTimeout(filterTimer);
  filterTimer = setTimeout(render, 80);
}

let filterTimer;
let cmcActive = null;   // which handle is being dragged: "lo" or "hi"

function cmcValueAt(clientX) {
  const r = cmcRangeEl.getBoundingClientRect();
  const frac = Math.min(1, Math.max(0, (clientX - r.left - 8) / (r.width - 16)));
  return Math.round(frac * cmcExtent);
}

cmcRangeEl.addEventListener("pointerdown", (e) => {
  const value = cmcValueAt(e.clientX);
  const [lo, hi] = cmcBounds();
  // grab the nearer handle; when both sit on the same value, the side you press on decides
  if (Math.abs(value - lo) !== Math.abs(value - hi)) cmcActive = Math.abs(value - lo) < Math.abs(value - hi) ? "lo" : "hi";
  else cmcActive = value < lo ? "lo" : value > hi ? "hi" : (hi === cmcExtent ? "lo" : "hi");
  cmcRangeEl.classList.add("dragging");
  (cmcActive === "lo" ? cmcLoThumb : cmcHiThumb).classList.add("active");
  cmcRangeEl.setPointerCapture(e.pointerId);
  setCmc(cmcActive, value);
});
cmcRangeEl.addEventListener("pointermove", (e) => {
  if (!cmcActive) return;
  const value = cmcValueAt(e.clientX);
  const [lo, hi] = cmcBounds();
  if (lo === hi) {   // both handles together: you can pull either one away
    const next = value < lo ? "lo" : value > hi ? "hi" : cmcActive;
    if (next !== cmcActive) {
      cmcLoThumb.classList.toggle("active", next === "lo");
      cmcHiThumb.classList.toggle("active", next === "hi");
      cmcActive = next;
    }
  }
  setCmc(cmcActive, value);
});
const endCmcDrag = () => {
  cmcActive = null;
  cmcRangeEl.classList.remove("dragging");
  cmcLoThumb.classList.remove("active");
  cmcHiThumb.classList.remove("active");
};
cmcRangeEl.addEventListener("pointerup", endCmcDrag);
cmcRangeEl.addEventListener("pointercancel", endCmcDrag);

// keyboard: focus a handle, then arrow keys / Home / End
for (const [thumb, which] of [[cmcLoThumb, "lo"], [cmcHiThumb, "hi"]]) {
  thumb.addEventListener("keydown", (e) => {
    const [lo, hi] = cmcBounds();
    const now = which === "lo" ? lo : hi;
    const next = { ArrowLeft: now - 1, ArrowDown: now - 1, ArrowRight: now + 1, ArrowUp: now + 1, Home: 0, End: cmcExtent }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    setCmc(which, Math.min(cmcExtent, Math.max(0, next)));
  });
}
drawCmcRange();

function updatePips() {
  for (const pip of pipEls) {
    const off = colorsOff.has(pip.dataset.color);
    pip.classList.toggle("off", off);
    pip.setAttribute("aria-pressed", String(!off));
  }
}
for (const pip of pipEls) {
  pip.addEventListener("click", () => {
    const color = pip.dataset.color;
    if (colorsOff.has(color)) colorsOff.delete(color); else colorsOff.add(color);
    prefs.set("colorsOff", [...colorsOff]);
    updatePips();
    render();
  });
}
document.getElementById("colorsNone").addEventListener("click", () => {
  pipEls.forEach((pip) => colorsOff.add(pip.dataset.color));
  prefs.set("colorsOff", [...colorsOff]);
  updatePips();
  render();
});
document.getElementById("colorsAll").addEventListener("click", () => {
  colorsOff.clear();
  prefs.set("colorsOff", []);
  updatePips();
  render();
});
updatePips();

function updateRarityPips() {
  for (const pip of rarityPipEls) {
    const off = raritiesOff.has(pip.dataset.rarity);
    pip.classList.toggle("off", off);
    pip.setAttribute("aria-pressed", String(!off));
  }
}
for (const pip of rarityPipEls) {
  pip.addEventListener("click", () => {
    const rarity = pip.dataset.rarity;
    if (raritiesOff.has(rarity)) raritiesOff.delete(rarity); else raritiesOff.add(rarity);
    prefs.set("raritiesOff", [...raritiesOff]);
    updateRarityPips();
    render();
  });
}
document.getElementById("raritiesNone").addEventListener("click", () => {
  rarityPipEls.forEach((pip) => raritiesOff.add(pip.dataset.rarity));
  prefs.set("raritiesOff", [...raritiesOff]);
  updateRarityPips();
  render();
});
document.getElementById("raritiesAll").addEventListener("click", () => {
  raritiesOff.clear();
  prefs.set("raritiesOff", []);
  updateRarityPips();
  render();
});
updateRarityPips();

// ---- sort dropdown ----
function updateSortUi() {
  const custom = !(sortKey === "added" && sortDir === "desc");
  sortButtonEl.textContent = (custom ? `Sort: ${SORT_LABELS[sortKey]} ${sortDir === "asc" ? "\u2191" : "\u2193"}` : "Sort") + " \u25BE";
  sortButtonEl.classList.toggle("active", custom);
  for (const r of sortPanelEl.querySelectorAll("input[name=sortKey]")) r.checked = r.value === sortKey;
  for (const b of sortPanelEl.querySelectorAll("[data-dir]")) b.classList.toggle("on", b.dataset.dir === sortDir);
}
function applySort() {
  prefs.set("sortKey", sortKey);
  prefs.set("sortDir", sortDir);
  updateSortUi();
  render();
}
sortButtonEl.addEventListener("click", () => {
  sortPanelEl.hidden = !sortPanelEl.hidden;
  if (!sortPanelEl.hidden) setPanelEl.hidden = true;
});
for (const r of sortPanelEl.querySelectorAll("input[name=sortKey]")) {
  r.addEventListener("change", () => {
    if (sortKey === "added" && sortDir === "desc" && r.value !== "added") sortDir = "asc";   // leaving the default view: start ascending
    sortKey = r.value;
    applySort();
  });
}
for (const b of sortPanelEl.querySelectorAll("[data-dir]")) {
  b.addEventListener("click", () => { sortDir = b.dataset.dir; applySort(); });
}
document.addEventListener("click", (e) => { if (!e.target.closest("#sortPicker")) sortPanelEl.hidden = true; });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") sortPanelEl.hidden = true; });
updateSortUi();

// ---- reset: clear the search and every filter, so all the cards show again ----
document.getElementById("resetFilters").addEventListener("click", () => {
  searchEl.value = "";
  setSearchEl.value = "";
  selectedSets.clear();
  colorsOff.clear();
  raritiesOff.clear();
  sortKey = "added";
  sortDir = "desc";
  prefs.set("sortKey", sortKey);
  prefs.set("sortDir", sortDir);
  updateSortUi();
  cmcLo = 0;
  cmcHi = null;
  wantedSpace = "";
  foilFilterEl.value = "";
  prefs.set("foil", "");
  prefs.set("sets", []);
  prefs.set("colorsOff", []);
  prefs.set("raritiesOff", []);
  prefs.set("cmcLo", 0);
  prefs.set("cmcHi", null);
  prefs.set("space", "");
  refreshSpaceOptions();
  renderSetPicker();
  updatePips();
  updateRarityPips();
  drawCmcRange();
  render();
});

// ---- hover zoom (only while the "Zoom on hover" switch is on) ----
function hideZoom() { zoomEl.style.display = "none"; zoomCard = null; }

function placeZoom(cardEl) {
  const r = cardEl.getBoundingClientRect();
  const w = zoomEl.offsetWidth;
  const h = zoomEl.offsetHeight || w * 1.4;
  // beside the card (right if it fits, otherwise left), never off the screen
  let x = r.right + 12;
  if (x + w > window.innerWidth - 8) x = r.left - w - 12;
  x = Math.max(8, x);
  const y = Math.min(Math.max(8, r.top + r.height / 2 - h / 2), window.innerHeight - h - 8);
  zoomEl.style.left = `${x}px`;
  zoomEl.style.top = `${y}px`;
}

const loadedLarge = new Set();   // large images that are already in the browser cache
let zoomCard = null;             // the card the popup is currently showing

runsEl.addEventListener("mouseover", (e) => {
  if (!zoomToggleEl.checked) return;
  const cardEl = e.target.closest(".card");
  if (!cardEl || !cardEl.dataset.large || cardEl === zoomCard) return;
  zoomCard = cardEl;

  // Show the card's small grid image straight away (already loaded), so it never lags behind the mouse,
  // then swap in the sharp large version as soon as it has arrived.
  const large = cardEl.dataset.large;
  const small = cardEl.querySelector("img");
  zoomImgEl.onload = null;
  zoomImgEl.src = loadedLarge.has(large) || !small ? large : small.currentSrc || small.src;
  zoomEl.style.display = "block";
  placeZoom(cardEl);

  if (!loadedLarge.has(large)) {
    const loader = new Image();
    loader.onload = () => {
      loadedLarge.add(large);
      if (zoomCard === cardEl) zoomImgEl.src = large;   // only if the mouse is still on this card
    };
    loader.src = large;
  }
});
runsEl.addEventListener("mouseout", (e) => {
  if (!e.relatedTarget || !e.relatedTarget.closest || !e.relatedTarget.closest(".card")) hideZoom();
});
zoomToggleEl.addEventListener("change", () => { prefs.set("zoom", zoomToggleEl.checked); hideZoom(); });
window.addEventListener("scroll", hideZoom, { passive: true });

async function start() {
  if (!firebaseConfig.apiKey || firebaseConfig.apiKey.startsWith("PASTE") ||
      !firebaseConfig.appId || firebaseConfig.appId.startsWith("PASTE")) {
    hideLoading();
    setStatus("Not configured", "bad");
    showMessage("firebase-config.js still has placeholder values. Register a Web app in the Firebase " +
                "console and put its apiKey and appId in firebase-config.js (see README.md).");
    return;
  }

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  const q = query(collection(db, "cards"), orderBy(documentId()));
  onSnapshot(q, (snapshot) => {
    // after the first load, cards that are newly added flash once
    if (!firstSnapshot) {
      snapshot.docChanges().forEach((ch) => {
        if (ch.type === "added") {
          freshIds.add(ch.doc.id);
          setTimeout(() => { freshIds.delete(ch.doc.id); }, 2000);
        }
      });
    }
    firstSnapshot = false;
    hideLoading();   // the whole collection has arrived
    cards = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    refreshSpaceOptions();
    renderSetPicker();
    updateCmcExtent();
    setStatus(`Live ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`, "ok");
    showMessage("");
    render();
  }, (err) => {
    hideLoading();
    setStatus("Read failed", "bad");
    showMessage(`Could not read the cards: ${err.message}`);
  });
}

start();
