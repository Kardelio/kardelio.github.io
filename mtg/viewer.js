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
const runsEl = document.getElementById("runs");
const messageEl = document.getElementById("message");
const latestOnlyEl = document.getElementById("latestOnly");
const spaceFilterEl = document.getElementById("spaceFilter");

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

// The app stores the big PNG link; the "normal" JPG is much smaller and plenty for a grid.
function smallImage(url) {
  if (!url) return null;
  return url.replace("/png/", "/normal/").replace(/\.png(\?|$)/, ".jpg$1");
}

// the dropdown lists every collection space that appears on the saved cards
function refreshSpaceOptions() {
  const selected = spaceFilterEl.value;
  const spaces = [...new Set(cards.map((c) => c.collectionSpace).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  spaceFilterEl.replaceChildren(new Option("All spaces", ""));
  for (const s of spaces) spaceFilterEl.append(new Option(s, s));
  spaceFilterEl.value = spaces.includes(selected) ? selected : "";
}

function render() {
  const wanted = spaceFilterEl.value;
  const shown = wanted ? cards.filter((c) => c.collectionSpace === wanted) : cards;
  countEl.textContent = wanted ? `${shown.length} of ${cards.length}` : cards.length;
  runsEl.replaceChildren();

  // group by run, newest run first; inside a run the cards stay in scan order
  const runs = new Map();
  for (const c of shown) {
    const key = c.runStart || "unknown";
    if (!runs.has(key)) runs.set(key, []);
    runs.get(key).push(c);
  }
  let keys = [...runs.keys()].sort().reverse();
  if (latestOnlyEl.checked) keys = keys.slice(0, 1);

  for (const key of keys) {
    // newest card first: the card scanned last is at the top, the first one at the bottom
    const list = runs.get(key).slice().reverse();
    const section = document.createElement("section");
    section.className = "run";
    const title = document.createElement("h2");
    title.textContent = `Run started ${key.replace("_", " ").replace(/-/g, (m, i) => (i > 9 ? ":" : "-"))} - ${list.length} card${list.length === 1 ? "" : "s"}`;
    section.append(title);

    const grid = document.createElement("div");
    grid.className = "grid";
    for (const c of list) {
      const card = document.createElement("div");
      card.className = "card" + (freshIds.has(c.id) ? " fresh" : "");

      const src = smallImage(c.imageUri);
      if (src) {
        const img = document.createElement("img");
        img.loading = "lazy";
        img.alt = c.name || "";
        img.src = src;
        card.append(img);
      } else {
        const none = document.createElement("div");
        none.className = "noimg";
        none.textContent = "no image";
        card.append(none);
      }

      const info = document.createElement("div");
      info.className = "info";
      const name = document.createElement("div");
      name.className = "name";
      name.title = c.name || "";
      name.textContent = `#${c.scanNumber ?? "?"}  ${c.name ?? ""}`;
      const meta = document.createElement("div");
      meta.className = "meta";
      meta.textContent = `${c.setCode ?? ""} ${c.collectorNumber ?? ""}${c.setName ? " - " + c.setName : ""}`;
      info.append(name, meta);
      if (c.collectionSpace) {
        const space = document.createElement("div");
        space.className = "space";
        space.textContent = c.collectionSpace;
        space.title = "Collection space";
        info.append(space);
      }
      card.append(info);
      grid.append(card);
    }
    section.append(grid);
    runsEl.append(section);
  }
}

latestOnlyEl.addEventListener("change", render);
spaceFilterEl.addEventListener("change", render);

async function start() {
  if (!firebaseConfig.apiKey || firebaseConfig.apiKey.startsWith("PASTE") ||
      !firebaseConfig.appId || firebaseConfig.appId.startsWith("PASTE")) {
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
    cards = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    refreshSpaceOptions();
    setStatus(`Live - updated ${new Date().toLocaleTimeString()}`, "ok");
    showMessage("");
    render();
  }, (err) => {
    setStatus("Read failed", "bad");
    showMessage(`Could not read the cards: ${err.message}`);
  });
}

start();
