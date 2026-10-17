/* GridScope — app logic.
   Ships with NO data: becomes functional after importing a data file
   (docs/DATA_FORMAT.md). Everything stays on the device. */

let dataset = null;  // raw imported object
let pbList = [];     // [{key, ct, invCount, boxCount}] sorted by ct
let invIndex = null; // Map<"n.m", {pbKey, ct, boxes:[sb], slot}>
let sbIndex = null;  // Map<int, [{ct, inv, sb, slot}]>

const SLOTS = 8; // categorical series slots --s1..--s8
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const slotVar = (slot) => `var(--s${(slot % SLOTS) + 1})`;
const buzz = () => navigator.vibrate && navigator.vibrate(8);

/* ---------- indexing ---------- */

const numOf = (s) => { const m = String(s).match(/\d+/); return m ? parseInt(m[0], 10) : 0; };

function invSort(a, b) {
  const [a1, a2] = a.split(".").map(Number);
  const [b1, b2] = b.split(".").map(Number);
  return a1 - b1 || a2 - b2;
}

function buildIndexes(data) {
  pbList = [];
  invIndex = new Map();
  sbIndex = new Map();
  const pbKeys = Object.keys(data.powerBlocks).sort((a, b) => numOf(a) - numOf(b));
  for (const pbKey of pbKeys) {
    const ct = numOf(pbKey);
    const invs = Object.keys(data.powerBlocks[pbKey].inverters).sort(invSort);
    let boxCount = 0;
    invs.forEach((inv, i) => {
      const boxes = [...data.powerBlocks[pbKey].inverters[inv]].sort((x, y) => numOf(x) - numOf(y));
      boxCount += boxes.length;
      invIndex.set(inv, { pbKey, ct, boxes, slot: i });
      for (const sb of boxes) {
        const n = numOf(sb);
        if (!sbIndex.has(n)) sbIndex.set(n, []);
        sbIndex.get(n).push({ ct, inv, sb, slot: i });
      }
    });
    pbList.push({ key: pbKey, ct, invCount: invs.length, boxCount });
  }
}

/* ---------- search ---------- */

function parseQuery(q) {
  const s = q.toUpperCase().trim();
  if (!s) return null;
  const pbTok = s.match(/PB\s*(\d+)/);
  const sbTok = s.match(/SB\s*(\d+)/);
  if (sbTok) {
    return { type: "sb", sb: parseInt(sbTok[1], 10), ct: pbTok ? parseInt(pbTok[1], 10) : null };
  }
  const invTok = s.match(/(\d+)\.(\d+)/);
  if (invTok) return { type: "inv", inv: `${parseInt(invTok[1], 10)}.${parseInt(invTok[2], 10)}` };
  const nums = s.match(/\d+/g);
  if (!nums) return null;
  if (nums.length >= 2) return { type: "sb", ct: parseInt(nums[0], 10), sb: parseInt(nums[1], 10) };
  return { type: "sb", sb: parseInt(nums[0], 10), ct: pbTok ? parseInt(pbTok[1], 10) : null };
}

function search(q) {
  const query = parseQuery(q);
  if (!query || !dataset) return null;
  if (query.type === "inv") {
    const hit = invIndex.get(query.inv);
    return hit ? { type: "inv", inv: query.inv, ...hit } : { type: "none" };
  }
  let hits = sbIndex.get(query.sb) || [];
  if (query.ct !== null) hits = hits.filter((h) => h.ct === query.ct);
  return hits.length ? { type: "sb", hits } : { type: "none" };
}

/* ---------- router ---------- */

const VIEWS = ["view-home", "view-explorer", "view-search", "view-docs", "view-data"];

function route() {
  const hash = location.hash.replace(/^#\/?/, "");
  const [seg, param] = hash.split("/");
  hideBanner();

  let view = "view-home";
  let title = null; // null => brand wordmark
  if (seg === "explorer") {
    view = "view-explorer";
    title = param ? `CT ${numOf(param)}` : "Plant Explorer";
    renderExplorer(param || null);
  } else if (seg === "search") {
    view = "view-search";
    title = "Quick Search";
  } else if (seg === "docs") {
    view = "view-docs";
    title = "Documents";
    renderDocs();
  } else if (seg === "data") {
    view = "view-data";
    title = "Data";
  } else {
    renderHome();
  }

  for (const id of VIEWS) $(id).classList.remove("active");
  const v = $(view);
  v.classList.add("active");
  void v.offsetWidth; // restart entrance animation

  $("btn-back").hidden = view === "view-home";
  $("top-title").innerHTML = title
    ? `<span style="font-weight:800">${esc(title)}</span>`
    : `<svg class="icon bolt-ico"><use href="#i-bolt"/></svg>GridScope`;
  $("main").scrollTop = 0;
  if (view === "view-search") $("search-input").focus();
}

/* ---------- home ---------- */

function renderHome() {
  const stats = $("home-stats");
  if (!dataset) {
    stats.innerHTML = "";
    $("home-alert").hidden = false;
    return;
  }
  $("home-alert").hidden = true;
  const s = datasetStats();
  stats.innerHTML = [
    [s.cts, "CTs"],
    [s.invs, "Inverters"],
    [s.boxes, "DC boxes"],
  ].map(([n, l], i) => `<div class="stat pop" style="--i:${i}"><b>${n}</b><span>${l}</span></div>`).join("");
}

/* ---------- explorer ---------- */

function emptyState() {
  return `<div class="empty pop"><svg class="icon z"><use href="#i-tray"/></svg>
    No data on this device yet.<br><a href="#/data">Import your plant file</a> to start exploring.</div>`;
}

function renderExplorer(pbKey) {
  const box = $("explorer-content");
  if (!dataset) { box.innerHTML = emptyState(); return; }
  if (pbKey && dataset.powerBlocks[pbKey]) { renderPB(box, pbKey); return; }

  box.innerHTML = `
    <div class="pagehead pop" style="--i:0">
      <h2>Transformer stations</h2>
      <p>Pick a CT to see its inverters and DC boxes.</p>
    </div>
    <div class="ctgrid">
      ${pbList.map((pb, i) => `
        <button class="cttile pop" style="--i:${i + 1}" data-pb="${esc(pb.key)}">
          <span class="ct-tag">CT</span>
          <span class="ct-num">${pb.ct}</span>
          <span class="ct-sub">${pb.invCount} INV · ${pb.boxCount} SB</span>
        </button>`).join("")}
    </div>`;
  box.querySelectorAll(".cttile").forEach((t) =>
    t.addEventListener("click", () => { buzz(); location.hash = `#/explorer/${t.dataset.pb}`; }));
}

/* PB detail with cross-highlighting */
let sel = null; // null | {type:'inv'|'sb', inv, sb?}
let refs = null;

function renderPB(box, pbKey) {
  sel = null;
  const invs = [...invIndex.entries()].filter(([, v]) => v.pbKey === pbKey);
  const ct = numOf(pbKey);
  const allBoxes = invs.flatMap(([inv, v]) => v.boxes.map((sb) => ({ sb, inv, slot: v.slot })))
    .sort((a, b) => numOf(a.sb) - numOf(b.sb));

  box.innerHTML = `
    <div class="pagehead pop" style="--i:0">
      <h2>CT ${ct} <span style="color:var(--faint);font-family:var(--mono);font-size:1rem">· ${esc(pbKey)}</span></h2>
      <p>Tap an inverter to light up its DC boxes — or tap a box to find its inverter.</p>
    </div>
    <div class="sec"><h3>Inverters</h3><span class="count">${invs.length}</span></div>
    <div class="invgrid">
      ${invs.map(([inv, v], i) => `
        <button class="invcard pop" style="--c:${slotVar(v.slot)};--i:${i}" data-inv="${esc(inv)}">
          <span class="swatch"></span>
          <span><span class="inv-name">INV ${esc(inv)}</span><br><span class="inv-sub">${v.boxes.length} DC boxes</span></span>
        </button>`).join("")}
    </div>
    <div class="sec"><h3>DC boxes</h3><span class="count">${allBoxes.length}</span></div>
    <div class="sbgrid">
      ${allBoxes.map((b, i) => `
        <button class="sbchip pop" style="--c:${slotVar(b.slot)};--i:${i}" data-sb="${esc(b.sb)}" data-inv="${esc(b.inv)}">
          <span class="sb-name">${esc(b.sb)}</span>
          <span class="sb-inv">→ ${esc(b.inv)}</span>
        </button>`).join("")}
    </div>`;

  refs = {
    ct,
    invEls: new Map([...box.querySelectorAll(".invcard")].map((el) => [el.dataset.inv, el])),
    sbEls: [...box.querySelectorAll(".sbchip")],
  };
  refs.invEls.forEach((el, inv) =>
    el.addEventListener("click", () => toggleSel({ type: "inv", inv })));
  refs.sbEls.forEach((el) =>
    el.addEventListener("click", () => toggleSel({ type: "sb", sb: el.dataset.sb, inv: el.dataset.inv })));
}

function toggleSel(next) {
  buzz();
  const same = sel && sel.type === next.type && sel.inv === next.inv && sel.sb === next.sb;
  sel = same ? null : next;
  applySel();
}

function applySel() {
  if (!refs) return;
  const { invEls, sbEls, ct } = refs;
  invEls.forEach((el) => el.classList.remove("lit", "lit-origin", "dim"));
  sbEls.forEach((el) => el.classList.remove("lit", "lit-origin", "dim"));
  if (!sel) { hideBanner(); return; }

  const inv = sel.inv;
  invEls.forEach((el, key) => el.classList.add(key === inv ? "lit" : "dim"));
  sbEls.forEach((el) => {
    if (el.dataset.inv !== inv) { el.classList.add("dim"); return; }
    el.classList.add("lit");
    if (sel.type === "sb" && el.dataset.sb === sel.sb) el.classList.add("lit-origin");
  });
  if (sel.type === "inv") invEls.get(inv).classList.add("lit-origin");

  const color = invEls.get(inv).style.getPropertyValue("--c");
  const boxes = invIndex.get(inv).boxes;
  showBanner(sel.type === "sb"
    ? chainHTML(color, [[`CT ${ct}`, "STATION", false], [`INV ${inv}`, "INVERTER", true], [sel.sb, "DC BOX", true]])
    : chainHTML(color, [[`CT ${ct}`, "STATION", false], [`INV ${inv}`, "INVERTER", true], [`${boxes.length} boxes`, "LIT BELOW", true]]));

  // nudge the scroll if the tapped element would sit under the banner
  const origin = sel.type === "sb"
    ? sbEls.find((el) => el.dataset.sb === sel.sb && el.dataset.inv === inv)
    : invEls.get(inv);
  requestAnimationFrame(() => {
    const b = $("chain-banner").getBoundingClientRect();
    const r = origin.getBoundingClientRect();
    const overlap = r.bottom - (b.top - 26);
    if (overlap > 0) $("main").scrollBy({ top: overlap, behavior: "smooth" });
  });
}

function chainHTML(color, nodes) {
  return nodes.map(([main, sub, hot]) =>
    `<span class="chain-node${hot ? " hot" : ""}" style="--c:${color}">${esc(main)}<small>${esc(sub)}</small></span>`
  ).join(`<span class="chain-arrow">›</span>`);
}

function showBanner(html) {
  $("chain-content").innerHTML = html;
  $("chain-banner").hidden = false;
  $("main").classList.add("with-banner");
}
function hideBanner() {
  $("chain-banner").hidden = true;
  $("main").classList.remove("with-banner");
  sel = null;
}

/* ---------- search view ---------- */

function renderResults(res) {
  const out = $("search-results");
  if (!res) { out.innerHTML = ""; return; }
  if (res.type === "none") {
    out.innerHTML = `<div class="nores"><svg class="icon z"><use href="#i-target"/></svg>No match found.</div>`;
    return;
  }
  if (res.type === "inv") {
    const c = slotVar(res.slot);
    out.innerHTML = `
      <div class="rescard pop" style="--c:${c}">
        ${chainHTML(c, [[`CT ${res.ct}`, "STATION", false], [`INV ${res.inv}`, "INVERTER", true]])}
        <div class="boxlist">
          ${res.boxes.map((b) => `<span class="minichip" style="--c:${c}">${esc(b)}</span>`).join("")}
        </div>
      </div>`;
    return;
  }
  out.innerHTML = res.hits.map((h, i) => {
    const c = slotVar(h.slot);
    return `<div class="rescard pop" style="--i:${i}">
      ${chainHTML(c, [[`CT ${h.ct}`, "STATION", false], [`INV ${h.inv}`, "INVERTER", true], [h.sb, "DC BOX", true]])}
    </div>`;
  }).join("");
}

/* ---------- documents ---------- */

const fmtSize = (b) => b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;

async function renderDocs() {
  const box = $("docs-list");
  let docs;
  try {
    docs = await DB.docsList();
  } catch (e) {
    box.innerHTML = `<div class="nores">Could not read stored documents: ${esc(e.message)}</div>`;
    return;
  }
  docs.sort((a, b) => a.name.localeCompare(b.name));
  const filter = $("docs-filter");
  filter.hidden = docs.length < 5;
  const q = filter.value.trim().toLowerCase();
  const shown = q ? docs.filter((d) => d.name.toLowerCase().includes(q)) : docs;

  if (!docs.length) {
    box.innerHTML = `<div class="empty pop"><svg class="icon z"><use href="#i-file"/></svg>
      No documents yet.<br>Add the plant PDFs you received.</div>`;
    return;
  }
  if (!shown.length) {
    box.innerHTML = `<div class="nores">No document matches the filter.</div>`;
    return;
  }
  box.innerHTML = shown.map((d, i) => `
    <div class="doccard pop" style="--i:${i}" data-id="${d.id}">
      <svg class="icon"><use href="#i-file"/></svg>
      <div class="doc-info">
        <div class="doc-name">${esc(d.name)}</div>
        <div class="doc-meta">${fmtSize(d.size)} · added ${esc(d.added)}</div>
      </div>
      <div class="doc-actions">
        <button class="iconbtn" data-act="open" aria-label="Open"><svg class="icon"><use href="#i-eye"/></svg></button>
        <button class="iconbtn" data-act="save" aria-label="Save to device"><svg class="icon"><use href="#i-dl"/></svg></button>
        <button class="iconbtn del" data-act="del" aria-label="Delete"><svg class="icon"><use href="#i-trash"/></svg></button>
      </div>
    </div>`).join("");

  box.querySelectorAll("[data-act]").forEach((btn) =>
    btn.addEventListener("click", () => docAction(btn.dataset.act, parseInt(btn.closest(".doccard").dataset.id, 10))));
}

async function docAction(act, id) {
  const doc = await DB.docsGet(id);
  if (!doc) return renderDocs();
  buzz();
  if (act === "del") {
    if (!confirm(`Delete "${doc.name}" from this device?`)) return;
    await DB.docsDelete(id);
    renderDocs();
    return;
  }
  const url = URL.createObjectURL(doc.blob);
  if (act === "open") {
    window.open(url, "_blank");
  } else {
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.name;
    a.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

async function addDocs(files) {
  const msg = $("doc-msg");
  msg.className = "msg";
  try {
    const existing = await DB.docsList();
    let added = 0, skipped = 0;
    for (const f of files) {
      if (existing.some((d) => d.name === f.name && d.size === f.size)) { skipped++; continue; }
      await DB.docsAdd({ name: f.name, size: f.size, type: f.type, added: new Date().toLocaleDateString(), blob: f });
      added++;
    }
    msg.textContent = `${added} document${added === 1 ? "" : "s"} added` + (skipped ? `, ${skipped} already stored.` : ".");
    msg.className = "msg ok";
    buzz();
    renderDocs();
  } catch (e) {
    msg.textContent = `Could not store documents: ${e.message}`;
    msg.className = "msg err";
  }
}

/* ---------- dataset lifecycle ---------- */

function validate(data) {
  if (!data || data.schema !== 1) return "Unsupported or missing schema version.";
  if (!data.powerBlocks || typeof data.powerBlocks !== "object") return "Missing powerBlocks.";
  for (const [pbKey, pb] of Object.entries(data.powerBlocks)) {
    if (!pb.inverters || typeof pb.inverters !== "object") return `${pbKey}: missing inverters.`;
    for (const [inv, boxes] of Object.entries(pb.inverters)) {
      if (!Array.isArray(boxes) || boxes.some((b) => typeof b !== "string")) {
        return `${pbKey} / inverter ${inv}: DC box list is invalid.`;
      }
    }
  }
  return null;
}

function datasetStats() {
  let invs = 0, boxes = 0;
  for (const pb of Object.values(dataset.powerBlocks)) {
    for (const b of Object.values(pb.inverters)) { invs++; boxes += b.length; }
  }
  return { cts: Object.keys(dataset.powerBlocks).length, invs, boxes };
}

function refreshUI() {
  const badge = $("dataset-badge");
  const has = !!dataset;
  $("btn-export").disabled = !has;
  $("btn-clear").disabled = !has;
  badge.hidden = has; // only warn when the app has no data
  badge.textContent = "NO DATA";
  badge.className = "badge badge-empty";
  $("data-meta").innerHTML = has
    ? `Source: <b>${esc(dataset.source || "unknown")}</b><br>` +
      (() => { const s = datasetStats(); return `CTs: <b>${s.cts}</b> · Inverters: <b>${s.invs}</b> · DC boxes: <b>${s.boxes}</b><br>`; })() +
      `Imported: <b>${esc(dataset._importedAt || "?")}</b>`
    : "No dataset loaded. Import a data file to activate the app.";
  route();
}

async function importFile(file) {
  const msg = $("import-msg");
  msg.className = "msg";
  try {
    const data = JSON.parse(await file.text());
    const err = validate(data);
    if (err) throw new Error(err);
    data._importedAt = new Date().toLocaleString();
    await DB.save(data);
    dataset = data;
    buildIndexes(dataset);
    refreshUI();
    msg.textContent = "Data imported successfully.";
    msg.className = "msg ok";
    buzz();
  } catch (e) {
    msg.textContent = `Import failed: ${e.message}`;
    msg.className = "msg err";
  }
}

function exportBackup() {
  const blob = new Blob([JSON.stringify(dataset, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `gridscope-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ---------- wiring ---------- */

$("btn-back").addEventListener("click", () => history.back());
$("chain-close").addEventListener("click", () => { hideBanner(); applySel(); });

$("search-input").addEventListener("input", (e) => {
  const q = e.target.value;
  $("search-hint").style.display = q.trim() ? "none" : "";
  if (!dataset) {
    $("search-results").innerHTML = q.trim()
      ? `<div class="nores"><span class="z">📥</span>No data loaded — <a href="#/data" style="color:var(--accent)">import a file</a> first.</div>` : "";
    return;
  }
  renderResults(q.trim() ? search(q) : null);
});

$("btn-adddoc").addEventListener("click", () => $("doc-file").click());
$("doc-file").addEventListener("change", (e) => {
  if (e.target.files.length) addDocs([...e.target.files]);
  e.target.value = "";
});
$("docs-filter").addEventListener("input", () => renderDocs());

$("btn-import").addEventListener("click", () => $("import-file").click());
$("import-file").addEventListener("change", (e) => {
  if (e.target.files[0]) importFile(e.target.files[0]);
  e.target.value = "";
});
$("btn-export").addEventListener("click", exportBackup);

$("btn-clear").addEventListener("click", async () => {
  if (!confirm("Delete all stored data from this device?")) return;
  await DB.clear();
  dataset = null;
  pbList = [];
  invIndex = sbIndex = null;
  $("search-results").innerHTML = "";
  $("clear-msg").textContent = "Stored data deleted.";
  $("clear-msg").className = "msg ok";
  refreshUI();
});

window.addEventListener("hashchange", route);

(async function init() {
  try {
    const stored = await DB.load();
    if (stored) {
      dataset = stored;
      buildIndexes(dataset);
    }
  } catch (e) {
    console.error("Failed to load stored data:", e);
  }
  refreshUI();
})();
