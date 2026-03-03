const state = {
  hotels: [],
  selectedHotel: null,
  originHistory: loadJson("ntt-origin-history", []),
  defaultOrigin: localStorage.getItem("ntt-default-origin") || "",
  hotelUrlHistory: loadJson("ntt-hotel-url-history", []),
  placeHistory: loadJson("ntt-place-history", []),
  activeHistoryDropdownIndex: null,
  activeTopHistoryDropdown: null,
  historyEditorChecks: {},
  historyEditorTarget: "place",
  originInlineChecks: {},
  originInlineDragIndex: null,
  originInlineEditMode: false,
  hotelExpanded: {},
  pendingExport: null,
  transportDays: loadTransportDays(),
  activeDayIndex: loadActiveDayIndex(),
  draggedPointIndex: null,
  draggedDayIndex: null,
  spots: [],
  history: loadJson("ntt-history", []),
  originUrlCandidates: [],
  destinationUrlCandidates: [],
};

Object.defineProperty(state, "transportPlan", {
  get() {
    if (!state.transportDays.length) {
      state.transportDays.push({ origin: "", points: [], expanded: true });
      state.activeDayIndex = 0;
    }
    if (state.activeDayIndex < 0 || state.activeDayIndex >= state.transportDays.length) {
      state.activeDayIndex = 0;
    }
    return state.transportDays[state.activeDayIndex];
  },
  set(value) {
    if (!state.transportDays.length) {
      state.transportDays.push(value);
      state.activeDayIndex = 0;
      return;
    }
    state.transportDays[state.activeDayIndex] = value;
  },
});

const els = {
  hotelForm: document.getElementById("hotel-register-form"),
  hotelUrlInput: document.getElementById("hotelUrl"),
  hotelUrlHistoryBtn: document.getElementById("hotel-url-history-btn"),
  hotelUrlHistoryEditBtn: document.getElementById("hotel-url-history-edit-btn"),
  hotelUrlHistoryDropdown: document.getElementById("hotel-url-history-dropdown"),
  hotelResults: document.getElementById("hotel-results"),
  hotelSort: document.getElementById("hotel-sort"),
  selectedHotel: document.getElementById("selected-hotel"),
  transportForm: document.getElementById("transport-form"),
  originInput: document.getElementById("origin"),
  defaultOriginInput: document.getElementById("default-origin-input"),
  saveDefaultOriginBtn: document.getElementById("save-default-origin"),
  useCurrentLocationBtn: document.getElementById("use-current-location"),
  destinationInput: document.getElementById("destination-input"),
  destinationHistoryBtn: document.getElementById("destination-history-btn"),
  destinationHistoryEditBtn: document.getElementById("destination-history-edit-btn"),
  destinationHistoryDropdown: document.getElementById("destination-history-dropdown"),
  destinationUrlSuggestBtn: document.getElementById("destination-url-suggest-btn"),
  destinationUrlCandidates: document.getElementById("destination-url-candidates"),
  destinationMapUrlWrap: document.getElementById("destination-map-url-wrap"),
  destinationMapUrlInput: document.getElementById("destination-map-url-input"),
  destinationMapUrlApply: document.getElementById("destination-map-url-apply"),
  originHistoryBtn: document.getElementById("origin-history-btn"),
  originHistoryEditBtn: document.getElementById("origin-history-edit-btn"),
  originHistoryDropdown: document.getElementById("origin-history-dropdown"),
  originUrlSuggestBtn: document.getElementById("origin-url-suggest-btn"),
  originUrlCandidates: document.getElementById("origin-url-candidates"),
  originMapUrlWrap: document.getElementById("origin-map-url-wrap"),
  originMapUrlInput: document.getElementById("origin-map-url-input"),
  originMapUrlApply: document.getElementById("origin-map-url-apply"),
  originHistory: document.getElementById("origin-history"),
  originInlineEditor: document.getElementById("origin-inline-editor"),
  originInlineHistoryList: document.getElementById("origin-inline-history-list"),
  originInlineSelectAll: document.getElementById("origin-inline-select-all"),
  originInlineDeleteSelected: document.getElementById("origin-inline-delete-selected"),
  addRoutePoint: document.getElementById("add-route-point"),
  addWaypointBtn: document.getElementById("add-waypoint-btn"),
  routeList: document.getElementById("route-list"),
  transportDetail: document.getElementById("transport-detail"),
  historyEditorModal: document.getElementById("history-editor-modal"),
  historyEditorList: document.getElementById("history-editor-list"),
  historyEditorClose: document.getElementById("history-editor-close"),
  historySelectAll: document.getElementById("history-select-all"),
  historyDeleteSelected: document.getElementById("history-delete-selected"),
  spotForm: document.getElementById("spot-form"),
  spotList: document.getElementById("spot-list"),
  itineraryOutput: document.getElementById("itinerary-output"),
  history: document.getElementById("history"),
  buildBtn: document.getElementById("build-itinerary"),
  clearAll: document.getElementById("clear-all"),
  exportAllDaysBtn: document.getElementById("export-all-days"),
  importAllDaysBtn: document.getElementById("import-all-days"),
  importAllDaysFile: document.getElementById("import-all-days-file"),
  exportChoiceModal: document.getElementById("export-choice-modal"),
  exportChoiceClose: document.getElementById("export-choice-close"),
  exportChoiceDownload: document.getElementById("export-choice-download"),
  exportChoiceAirdrop: document.getElementById("export-choice-airdrop"),
  exportChoiceLine: document.getElementById("export-choice-line"),
  status: document.getElementById("status"),
};

const siteMap = {
  "rakuten.co.jp": "楽天トラベル",
  "jalan.net": "じゃらん",
  "booking.com": "Booking.com",
  "ikyu.com": "一休",
  "agoda.com": "Agoda",
  "expedia.co.jp": "Expedia",
};

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function loadTransportDays() {
  const fallback = [{ origin: "", points: [], expanded: true }];
  const days = loadJson("ntt-transport-days", fallback);
  if (!Array.isArray(days) || !days.length) return fallback;
  const normalized = days.map((day, idx) => {
    const origin = typeof day?.origin === "string" ? day.origin : "";
    const points = Array.isArray(day?.points) ? day.points.map(ensurePointObject) : [];
    const expanded = typeof day?.expanded === "boolean" ? day.expanded : idx === 0;
    const segmentTimes =
      day?.segmentTimes && typeof day.segmentTimes === "object" && !Array.isArray(day.segmentTimes)
        ? day.segmentTimes
        : {};
    const next = { origin, points, expanded, segmentTimes };
    normalizePlanPoints(next);
    return next;
  });
  return normalized.length ? normalized : fallback;
}

function loadActiveDayIndex() {
  const raw = Number(localStorage.getItem("ntt-active-day-index"));
  return Number.isInteger(raw) && raw >= 0 ? raw : 0;
}

function saveTransportState() {
  const days = (state.transportDays || []).map((day, idx) => {
    const origin = typeof day?.origin === "string" ? day.origin : "";
    const points = Array.isArray(day?.points) ? day.points.map(ensurePointObject) : [];
    const expanded = typeof day?.expanded === "boolean" ? day.expanded : idx === state.activeDayIndex;
    const segmentTimes =
      day?.segmentTimes && typeof day.segmentTimes === "object" && !Array.isArray(day.segmentTimes)
        ? day.segmentTimes
        : {};
    return { origin, points, expanded, segmentTimes };
  });
  saveJson("ntt-transport-days", days);
  localStorage.setItem("ntt-active-day-index", String(state.activeDayIndex));
}

function getSegmentManualTime(dayIndex, segmentIndex) {
  const day = state.transportDays[dayIndex];
  if (!day || !day.segmentTimes || typeof day.segmentTimes !== "object") return "";
  return String(day.segmentTimes[String(segmentIndex)] || "");
}

function setSegmentManualTime(dayIndex, segmentIndex, value) {
  const day = state.transportDays[dayIndex];
  if (!day) return;
  if (!day.segmentTimes || typeof day.segmentTimes !== "object") {
    day.segmentTimes = {};
  }
  const key = String(segmentIndex);
  const normalized = String(value || "");
  if (!normalized) {
    delete day.segmentTimes[key];
  } else {
    day.segmentTimes[key] = normalized;
  }
}

function formatMinutesShort(totalMinutes) {
  const minutes = Math.max(0, Number(totalMinutes) || 0);
  const hour = Math.floor(minutes / 60);
  const min = minutes % 60;
  if (hour <= 0) return `${min}m`;
  return `${hour}h${String(min).padStart(2, "0")}m`;
}

function buildSegmentTimeOptions(selectedValue = "") {
  const selected = String(selectedValue || "");
  let html = `<option value="" ${selected === "" ? "selected" : ""}>時間</option>`;
  for (let minute = 5; minute <= 720; minute += 5) {
    const label = formatMinutesShort(minute);
    html += `<option value="${minute}" ${selected === String(minute) ? "selected" : ""}>${label}</option>`;
  }
  return html;
}

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function setStatus(msg, isWarning = false) {
  els.status.textContent = msg;
  els.status.className = isWarning ? "status wrap warning" : "status wrap";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function shareOrDownloadJson(filename, payload) {
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const file = new File([blob], filename, { type: "application/json" });

  if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        title: filename,
        files: [file],
      });
      return "shared";
    } catch {
      // User canceled or share failed, fallback to download.
    }
  }

  downloadJson(filename, payload);
  return "downloaded";
}

async function shareJsonViaNative(filename, payload) {
  const json = JSON.stringify(payload, null, 2);
  const file = new File([json], filename, { type: "application/json" });
  if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({
      title: filename,
      files: [file],
    });
    return;
  }
  throw new Error("native-share-not-supported");
}

async function shareJsonToLine(filename, payload) {
  const json = JSON.stringify(payload, null, 2);
  const file = new File([json], filename, { type: "application/json" });

  // Prefer native share sheet on mobile; LINE can be selected there.
  if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        title: filename,
        text: "ルートデータを共有します",
        files: [file],
      });
      return "shared";
    } catch {
      // fallback below
    }
  }

  // Fallback: LINE text share (file attachment is not available in this mode).
  const preview = json.length > 1800 ? `${json.slice(0, 1800)}\n...(省略)` : json;
  const lineText = `ルートデータ: ${filename}\n${preview}`;
  const lineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(lineText)}`;
  window.open(lineUrl, "_blank", "noopener,noreferrer");
  return "line_text";
}

function openExportChoiceModal(filename, payload) {
  state.pendingExport = { filename, payload };
  if (!els.exportChoiceModal) return;
  els.exportChoiceModal.classList.remove("hidden");
  els.exportChoiceModal.setAttribute("aria-hidden", "false");
}

function closeExportChoiceModal() {
  state.pendingExport = null;
  if (!els.exportChoiceModal) return;
  els.exportChoiceModal.classList.add("hidden");
  els.exportChoiceModal.setAttribute("aria-hidden", "true");
}

async function readJsonFile(file) {
  const text = await file.text();
  return JSON.parse(text);
}

function isMobileDevice() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "");
}

function openGoogleMap(url) {
  if (!url) return;
  if (isMobileDevice()) {
    // Mobile: avoid popup blockers/extra dialogs from window.open.
    window.location.href = url;
    return;
  }
  const popup = window.open(url, "_blank", "noopener,noreferrer");
  if (popup) return;
  window.location.href = url;
}

function openYahooCarNaviRoute(from, to) {
  const fromName = (from || "").trim();
  const toName = (to || "").trim();
  if (!fromName || !toName) return;
  const routeUrl = `https://map.yahoo.co.jp/route/car?from=${encodeURIComponent(fromName)}&to=${encodeURIComponent(toName)}`;
  if (isMobileDevice()) {
    window.location.href = routeUrl;
    return;
  }
  const popup = window.open(routeUrl, "_blank", "noopener,noreferrer");
  if (popup) return;
  window.location.href = routeUrl;
}

function openMapPicker(url = "https://www.google.com/maps") {
  const popup = window.open(url, "_blank", "noopener,noreferrer");
  if (popup) return true;
  setStatus("地図を新しいタブで開けませんでした。ブラウザ設定を確認してください。", true);
  return false;
}

function extractLatLng(text) {
  const value = String(text || "");
  const currentMatch = value.match(/現在地\(\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)\s*\)/);
  if (currentMatch) {
    return { lat: Number(currentMatch[1]), lng: Number(currentMatch[2]) };
  }
  const genericMatch = value.match(/([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)/);
  if (genericMatch) {
    return { lat: Number(genericMatch[1]), lng: Number(genericMatch[2]) };
  }
  return null;
}

function haversineKm(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const x = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return 6371 * c;
}

function getDriveTimeLabel(fromName, toName) {
  const from = extractLatLng(fromName);
  const to = extractLatLng(toName);
  if (!from || !to) return "予測";
  const km = haversineKm(from, to);
  const roadKm = km * 1.25;
  const minutes = Math.max(1, Math.round((roadKm / 40) * 60));
  return `予測 ${formatMinutesShort(minutes)}`;
}

function saveOriginHistory(origin) {
  const normalized = origin.trim();
  if (!normalized) return;
  state.originHistory = [normalized, ...state.originHistory.filter((item) => item !== normalized)].slice(0, 10);
  saveJson("ntt-origin-history", state.originHistory);
  renderOriginHistory();
  renderOriginInlineEditor();
}

function saveDefaultOrigin(value) {
  const normalized = (value || "").trim();
  state.defaultOrigin = normalized;
  localStorage.setItem("ntt-default-origin", normalized);
}

function saveHotelUrlHistory(url, preferredName = "") {
  const normalized = url.trim();
  if (!normalized) return;
  const existing = state.hotelUrlHistory.find((item) => item.url === normalized);
  const parsed = buildHotelFromUrl(normalized);
  const displayName = existing?.name || preferredName.trim() || parsed?.name || normalized;
  saveHotelUrlHistoryEntry(normalized, displayName);
}

function saveHotelUrlHistoryEntry(url, name) {
  const normalizedUrl = (url || "").trim();
  if (!normalizedUrl) return;
  const normalizedName = (name || "").trim() || normalizedUrl;
  const next = { url: normalizedUrl, name: normalizedName };
  state.hotelUrlHistory = [next, ...state.hotelUrlHistory.filter((item) => item.url !== normalizedUrl)].slice(0, 20);
  saveJson("ntt-hotel-url-history", state.hotelUrlHistory);
}

function renameHotelUrlHistoryEntry(url, nextName) {
  const normalizedUrl = (url || "").trim();
  const normalizedName = (nextName || "").trim();
  if (!normalizedUrl || !normalizedName) return;
  state.hotelUrlHistory = state.hotelUrlHistory.map((item) =>
    item.url === normalizedUrl ? { ...item, name: normalizedName } : item,
  );
  saveJson("ntt-hotel-url-history", state.hotelUrlHistory);
}

function savePlaceHistory(name) {
  const normalized = name.trim();
  if (!normalized) return;
  state.placeHistory = [normalized, ...state.placeHistory.filter((item) => item !== normalized)].slice(0, 50);
  saveJson("ntt-place-history", state.placeHistory);
}

function findHotelUrlHistoryByName(name) {
  const normalized = (name || "").trim();
  if (!normalized) return null;
  return state.hotelUrlHistory.find((entry) => (entry?.name || "").trim() === normalized) || null;
}

function ensureHotelInListFromHistoryName(name) {
  const historyEntry = findHotelUrlHistoryByName(name);
  if (!historyEntry || !historyEntry.url) return null;
  const existing = state.hotels.find((hotel) => hotel.url === historyEntry.url);
  if (existing) {
    return existing;
  }
  const item = buildHotelFromUrl(historyEntry.url, historyEntry.name || name);
  if (!item) return null;
  state.hotels.push(item);
  return item;
}

function getHistoryByTarget(target) {
  if (target === "origin") return state.originHistory;
  if (target === "hotelUrl") return state.hotelUrlHistory;
  return state.placeHistory;
}

function setHistoryByTarget(target, list) {
  if (target === "origin") {
    state.originHistory = list;
    saveJson("ntt-origin-history", state.originHistory);
    renderOriginHistory();
    return;
  }
  if (target === "hotelUrl") {
    state.hotelUrlHistory = list;
    saveJson("ntt-hotel-url-history", state.hotelUrlHistory);
    return;
  }
  state.placeHistory = list;
  saveJson("ntt-place-history", state.placeHistory);
}

function replacePlaceHistoryName(prevName, nextName) {
  const prev = (prevName || "").trim();
  const next = (nextName || "").trim();
  if (!prev || !next || prev === next) return;

  state.placeHistory = state.placeHistory
    .filter((item) => item !== prev && item !== next)
    .slice(0, 49);
  state.placeHistory.unshift(next);
  saveJson("ntt-place-history", state.placeHistory);
}

function renderHistoryEditorList() {
  if (!els.historyEditorList) return;
  const historyList = getHistoryByTarget(state.historyEditorTarget);
  if (!historyList.length) {
    els.historyEditorList.innerHTML = "<p class='muted'>履歴がありません。</p>";
    return;
  }

  els.historyEditorList.innerHTML = historyList
    .map((item) => {
      const key = state.historyEditorTarget === "hotelUrl" ? item.url : item;
      const label = state.historyEditorTarget === "hotelUrl" ? item.name : item;
      const sub = state.historyEditorTarget === "hotelUrl" ? `<small class="muted">${item.url}</small>` : "";
      const checked = Boolean(state.historyEditorChecks[key]);
      return `
        <label class="history-item">
          <input type="checkbox" data-history-check="${encodeURIComponent(key)}" ${checked ? "checked" : ""} />
          <span>${label}${sub ? `<br />${sub}` : ""}</span>
        </label>
      `;
    })
    .join("");
}

function openHistoryEditor(target = "place") {
  state.historyEditorTarget = target;
  state.historyEditorChecks = {};
  els.historyEditorModal.classList.remove("hidden");
  els.historyEditorModal.setAttribute("aria-hidden", "false");
  renderHistoryEditorList();
}

function closeHistoryEditor() {
  els.historyEditorModal.classList.add("hidden");
  els.historyEditorModal.setAttribute("aria-hidden", "true");
}

function renderOriginHistory() {
  if (!els.originHistory) return;
  els.originHistory.innerHTML = state.originHistory.map((o) => `<option value="${o}"></option>`).join("");
}

function renderOriginUrlCandidates() {
  if (!els.originUrlCandidates) return;
  const list = Array.isArray(state.originUrlCandidates) ? state.originUrlCandidates : [];
  if (!list.length) {
    els.originUrlCandidates.classList.add("hidden");
    els.originUrlCandidates.innerHTML = "";
    return;
  }
  els.originUrlCandidates.classList.remove("hidden");
  els.originUrlCandidates.innerHTML = list
    .map(
      (candidate) =>
        `<button type="button" class="ghost tiny" data-apply-origin-url-candidate="${encodeURIComponent(candidate)}">${escapeHtml(candidate)}</button>`,
    )
    .join("");
}

function renderDestinationUrlCandidates() {
  if (!els.destinationUrlCandidates) return;
  const list = Array.isArray(state.destinationUrlCandidates) ? state.destinationUrlCandidates : [];
  if (!list.length) {
    els.destinationUrlCandidates.classList.add("hidden");
    els.destinationUrlCandidates.innerHTML = "";
    return;
  }
  els.destinationUrlCandidates.classList.remove("hidden");
  els.destinationUrlCandidates.innerHTML = list
    .map(
      (candidate) =>
        `<button type="button" class="ghost tiny" data-apply-destination-url-candidate="${encodeURIComponent(candidate)}">${escapeHtml(candidate)}</button>`,
    )
    .join("");
}

function suggestCandidatesFromPastedUrl(target, sourceUrl = "") {
  const url = (sourceUrl || "").trim();
  if (!url) return;
  const candidates = extractNameCandidatesFromUrl(url);
  if (!candidates.length) {
    setStatus("URLから候補を抽出できませんでした。", true);
    return;
  }
  if (target === "origin") {
    state.originUrlCandidates = candidates;
    renderOriginUrlCandidates();
  } else {
    state.destinationUrlCandidates = candidates;
    renderDestinationUrlCandidates();
  }
  setStatus("URLから名称候補を取得しました。候補ボタンで反映できます。");
}

function openMapAndShowUrlInput(target) {
  if (target === "origin") {
    if (els.originMapUrlWrap) {
      els.originMapUrlWrap.classList.remove("hidden");
    }
    if (els.originMapUrlInput) {
      window.setTimeout(() => els.originMapUrlInput.focus(), 0);
    }
  } else if (target === "destination") {
    if (els.destinationMapUrlWrap) {
      els.destinationMapUrlWrap.classList.remove("hidden");
    }
    if (els.destinationMapUrlInput) {
      window.setTimeout(() => els.destinationMapUrlInput.focus(), 0);
    }
  }
  openMapPicker("https://www.google.com/maps");
}

function setOriginInlineEditMode(enabled) {
  state.originInlineEditMode = Boolean(enabled);
  if (!els.originHistoryEditBtn || !els.defaultOriginInput || !els.saveDefaultOriginBtn) return;
  els.originHistoryEditBtn.textContent = state.originInlineEditMode ? "✕" : "☰";
  els.originHistoryEditBtn.classList.toggle("origin-edit-active", state.originInlineEditMode);
  els.defaultOriginInput.readOnly = !state.originInlineEditMode;
  if (!state.originInlineEditMode) {
    els.defaultOriginInput.value = state.defaultOrigin || "";
  }
  els.saveDefaultOriginBtn.textContent = "DEFAULT";
}

function renderOriginInlineEditor() {
  if (!els.originInlineHistoryList || !els.defaultOriginInput) return;
  const defaultName = (state.defaultOrigin || "").trim();
  const historyList = (state.originHistory || [])
    .map((name, sourceIndex) => ({ name, sourceIndex }))
    .filter(({ name }) => name && name !== defaultName);
  if (!defaultName && historyList.length) {
    saveDefaultOrigin(historyList[0].name);
    state.originHistory = historyList.slice(1).map((item) => item.name);
    saveJson("ntt-origin-history", state.originHistory);
  }

  const safeDefault = state.defaultOrigin || "";
  els.defaultOriginInput.value = safeDefault;
  const checkedDefault = Boolean(state.originInlineChecks[safeDefault]);
  const defaultCheckbox = document.querySelector("input[data-origin-inline-check='0']");
  if (defaultCheckbox) {
    defaultCheckbox.checked = checkedDefault;
  }
  if (els.saveDefaultOriginBtn) {
    els.saveDefaultOriginBtn.classList.add("is-default");
    els.saveDefaultOriginBtn.classList.remove("is-not-default");
  }

  els.originInlineHistoryList.innerHTML = historyList
    .map(({ name, sourceIndex }, idx) => {
      const key = encodeURIComponent(name);
      const checked = Boolean(state.originInlineChecks[name]);
      return `
        <div class="origin-inline-item" data-origin-index="${idx + 1}" draggable="true">
          <label class="origin-inline-check-wrap">
            <input type="checkbox" data-origin-inline-check-name="${key}" ${checked ? "checked" : ""} />
          </label>
          <input
            type="text"
            class="origin-inline-name-input"
            data-origin-inline-source-index="${sourceIndex}"
            value="${escapeHtml(name)}"
          />
          <button
            type="button"
            class="origin-default-btn is-not-default"
            data-set-default-origin="${key}"
          >DEFAULT</button>
        </div>
      `;
    })
    .join("");
}

function renameOriginHistoryBySourceIndex(sourceIndex, nextNameRaw) {
  const idx = Number(sourceIndex);
  if (!Number.isInteger(idx) || idx < 0 || idx >= state.originHistory.length) return;
  const prev = (state.originHistory[idx] || "").trim();
  const next = (nextNameRaw || "").trim();
  if (!prev) return;
  if (!next) {
    setStatus("履歴名は空欄にできません。", true);
    renderOriginInlineEditor();
    return;
  }
  if (prev === next) return;
  if (next === (state.defaultOrigin || "").trim()) {
    state.originHistory = state.originHistory.filter((name, i) => i !== idx);
  } else if (state.originHistory.some((name, i) => i !== idx && (name || "").trim() === next)) {
    setStatus("同じ履歴名が既にあります。", true);
    renderOriginInlineEditor();
    return;
  } else {
    state.originHistory[idx] = next;
  }

  if (Object.prototype.hasOwnProperty.call(state.originInlineChecks, prev)) {
    state.originInlineChecks[next] = state.originInlineChecks[prev];
    delete state.originInlineChecks[prev];
  }
  saveJson("ntt-origin-history", state.originHistory);
  renderOriginHistory();
  renderOriginInlineEditor();
  setStatus("履歴名を更新しました。");
}

function setOriginInlineEditorOpen(isOpen) {
  if (!els.originInlineEditor) return;
  els.originInlineEditor.classList.toggle("hidden", !isOpen);
  setOriginInlineEditMode(isOpen);
  if (isOpen) {
    state.originInlineChecks = {};
    renderOriginInlineEditor();
  }
}

function applyDefaultOriginFromInput(value) {
  const normalized = (value || "").trim();
  if (!normalized) {
    setStatus("デフォルト出発地を入力してください。", true);
    return false;
  }
  saveDefaultOrigin(normalized);
  saveOriginHistory(normalized);
  if (els.originInput) {
    els.originInput.value = normalized;
  }
  if (Number.isInteger(state.activeDayIndex) && state.activeDayIndex >= 0 && state.activeDayIndex < state.transportDays.length) {
    state.transportDays[state.activeDayIndex].origin = normalized;
  }
  renderOriginInlineEditor();
  renderRouteList();
  renderTransportDetail();
  return true;
}

function moveOriginHistoryEntryToDefault(name) {
  const normalized = (name || "").trim();
  if (!normalized) return;
  const nextHistory = [state.defaultOrigin, ...state.originHistory]
    .map((item) => (item || "").trim())
    .filter((item) => item && item !== normalized);
  saveDefaultOrigin(normalized);
  state.originHistory = nextHistory.slice(0, 10);
  saveJson("ntt-origin-history", state.originHistory);
  if (els.originInput) {
    els.originInput.value = normalized;
  }
  if (Number.isInteger(state.activeDayIndex) && state.activeDayIndex >= 0 && state.activeDayIndex < state.transportDays.length) {
    state.transportDays[state.activeDayIndex].origin = normalized;
  }
  renderOriginHistory();
  renderOriginInlineEditor();
  renderRouteList();
  renderTransportDetail();
}

function normalizeStoredHistories() {
  state.hotelUrlHistory = (state.hotelUrlHistory || [])
    .map((item) => {
      if (typeof item === "string") {
        const parsed = buildHotelFromUrl(item);
        return { url: item, name: parsed?.name || item };
      }
      return {
        url: (item?.url || "").trim(),
        name: (item?.name || item?.url || "").trim(),
      };
    })
    .filter((item) => item.url)
    .slice(0, 20);
  saveJson("ntt-hotel-url-history", state.hotelUrlHistory);
}

function renderTopHistoryDropdown(target) {
  let list = getHistoryByTarget(target);
  if (target === "origin") {
    const defaultName = (state.defaultOrigin || "").trim();
    const merged = [defaultName, ...(Array.isArray(list) ? list : [])]
      .map((item) => String(item || "").trim())
      .filter(Boolean);
    list = [...new Set(merged)];
  }
  const dropdown =
    target === "origin"
      ? els.originHistoryDropdown
      : target === "destination"
        ? els.destinationHistoryDropdown
        : els.hotelUrlHistoryDropdown;
  if (!dropdown) return;

  if (!list.length) {
    dropdown.innerHTML = "<span class='muted'>履歴がありません</span>";
    return;
  }

  dropdown.innerHTML = list
    .slice(0, 12)
    .map(
      (item) => {
        if (target === "hotelUrl") {
          const label = item.name;
          return `<button type="button" class="ghost tiny" data-use-top-history="${target}" data-history-value="${encodeURIComponent(item.url)}">${label}</button>`;
        }
        return `<button type="button" class="ghost tiny" data-use-top-history="${target}" data-history-value="${encodeURIComponent(item)}">${item}</button>`;
      },
    )
    .join("");
}

function renderTopHistoryDropdownForElement(target, dropdown) {
  if (!dropdown) return;
  let list = getHistoryByTarget(target);
  if (target === "origin") {
    const defaultName = (state.defaultOrigin || "").trim();
    const merged = [defaultName, ...(Array.isArray(list) ? list : [])]
      .map((item) => String(item || "").trim())
      .filter(Boolean);
    list = [...new Set(merged)];
  }
  if (!list.length) {
    dropdown.innerHTML = "<span class='muted'>履歴がありません</span>";
    return;
  }
  dropdown.innerHTML = list
    .slice(0, 12)
    .map((item) => {
      if (target === "hotelUrl") {
        const label = item.name;
        return `<button type="button" class="ghost tiny" data-use-top-history="${target}" data-history-value="${encodeURIComponent(item.url)}">${label}</button>`;
      }
      return `<button type="button" class="ghost tiny" data-use-top-history="${target}" data-history-value="${encodeURIComponent(item)}">${item}</button>`;
    })
    .join("");
}

function closeAllDayHistoryDropdowns() {
  document
    .querySelectorAll("[data-day-role='origin-history-dropdown'], [data-day-role='destination-history-dropdown'], [data-day-role='hotel-url-history-dropdown']")
    .forEach((el) => el.classList.add("hidden"));
}

function applyCurrentLocationToDay(dayIndex) {
  if (!navigator.geolocation) {
    setStatus("この端末では現在地取得に対応していません。", true);
    return;
  }

  setStatus("現在地を取得しています...");
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude.toFixed(5);
      const lng = position.coords.longitude.toFixed(5);
      const current = `現在地(${lat}, ${lng})`;
      const targetDay =
        Number.isInteger(dayIndex) && dayIndex >= 0 && dayIndex < state.transportDays.length
          ? dayIndex
          : state.activeDayIndex;
      state.transportDays[targetDay].origin = current;
      if (targetDay === state.activeDayIndex && els.originInput) {
        els.originInput.value = current;
      }
      saveOriginHistory(current);
      renderOriginInlineEditor();
      renderRouteList();
      renderTransportDetail();
      setStatus("現在地を出発地に設定しました。");
    },
    () => {
      setStatus("現在地の取得に失敗しました。位置情報の許可を確認してください。", true);
    },
    { enableHighAccuracy: true, timeout: 10000 },
  );
}

function toggleDayHistoryDropdown(card, target) {
  if (!card) return;
  const role =
    target === "origin"
      ? "origin-history-dropdown"
      : target === "destination"
        ? "destination-history-dropdown"
        : "hotel-url-history-dropdown";
  const dropdown = card.querySelector(`[data-day-role='${role}']`);
  if (!dropdown) return;
  const willOpen = dropdown.classList.contains("hidden");
  closeAllDayHistoryDropdowns();
  if (willOpen) {
    renderTopHistoryDropdownForElement(target, dropdown);
    dropdown.classList.remove("hidden");
  } else {
    dropdown.classList.add("hidden");
  }
}

function toggleTopHistoryDropdown(target) {
  if (state.activeTopHistoryDropdown === target) {
    state.activeTopHistoryDropdown = null;
  } else {
    state.activeTopHistoryDropdown = target;
    renderTopHistoryDropdown(target);
  }

  if (els.originHistoryDropdown) {
    els.originHistoryDropdown.classList.toggle("hidden", state.activeTopHistoryDropdown !== "origin");
  }
  if (els.hotelUrlHistoryDropdown) {
    els.hotelUrlHistoryDropdown.classList.toggle("hidden", state.activeTopHistoryDropdown !== "hotelUrl");
  }
  if (els.destinationHistoryDropdown) {
    els.destinationHistoryDropdown.classList.toggle("hidden", state.activeTopHistoryDropdown !== "destination");
  }
}

function closeTopHistoryDropdowns() {
  state.activeTopHistoryDropdown = null;
  if (els.originHistoryDropdown) {
    els.originHistoryDropdown.classList.add("hidden");
  }
  if (els.hotelUrlHistoryDropdown) {
    els.hotelUrlHistoryDropdown.classList.add("hidden");
  }
  if (els.destinationHistoryDropdown) {
    els.destinationHistoryDropdown.classList.add("hidden");
  }
}

function calcNights(checkin, checkout) {
  if (!checkin || !checkout) return 1;
  const ms = new Date(checkout) - new Date(checkin);
  const nights = Math.ceil(ms / (1000 * 60 * 60 * 24));
  return Math.max(1, nights);
}

function toIsoDate(value) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (/^\d{8}$/.test(value)) {
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  }
  return "";
}

function parseNumber(raw) {
  if (!raw) return 0;
  const num = Number(String(raw).replace(/[^\d.]/g, ""));
  return Number.isFinite(num) ? Math.round(num) : 0;
}

function getParam(params, keys) {
  for (const key of keys) {
    const value = params.get(key);
    if (value) return value;
  }
  return "";
}

function hashSeed(text) {
  let h = 0;
  for (let i = 0; i < text.length; i += 1) {
    h = (h * 33 + text.charCodeAt(i)) % 99991;
  }
  return h;
}

function parseSiteName(host) {
  const plainHost = host.replace(/^www\./, "");
  for (const domain of Object.keys(siteMap)) {
    if (plainHost.includes(domain)) return siteMap[domain];
  }
  return plainHost;
}

function parseHotelName(urlObj) {
  const params = urlObj.searchParams;
  const fromParam = getParam(params, ["hotelName", "hotel", "name", "property", "facility", "roomName"]);
  if (fromParam) return decodeURIComponent(fromParam).replace(/\+/g, " ").trim();

  const path = decodeURIComponent(urlObj.pathname)
    .split("/")
    .filter(Boolean)
    .pop();

  if (!path) return "宿名未取得";
  return path
    .replace(/[-_]/g, " ")
    .replace(/\.[a-zA-Z0-9]+$/, "")
    .trim();
}

function isUnknownArea(area) {
  return !area || area === "エリア未取得";
}

function buildHotelFromUrl(rawUrl, preferredName = "") {
  let urlObj;
  try {
    urlObj = new URL(rawUrl);
  } catch {
    return null;
  }

  const params = urlObj.searchParams;
  const site = parseSiteName(urlObj.hostname);
  const parsedName = parseHotelName(urlObj);
  const name = preferredName.trim() || parsedName;

  let checkin = toIsoDate(getParam(params, ["checkin", "checkIn", "checkinDate", "arrival", "dateFrom"]));
  let checkout = toIsoDate(getParam(params, ["checkout", "checkOut", "checkoutDate", "departure", "dateTo"]));

  if (!checkin) {
    checkin = new Date().toISOString().slice(0, 10);
  }
  if (!checkout) {
    const next = new Date(checkin);
    next.setDate(next.getDate() + 1);
    checkout = next.toISOString().slice(0, 10);
  }

  const area = decodeURIComponent(
    getParam(params, ["area", "city", "region", "destination", "prefecture", "place"]) || "",
  ).replace(/\+/g, " ");

  const people = Number(getParam(params, ["adults", "adult", "guests", "people", "person"]) || 2);

  let price = parseNumber(getParam(params, ["price", "totalPrice", "roomPrice", "minPrice", "hotelPrice", "amount"]));
  let priceEstimated = false;

  if (!price) {
    price = 7000 + (hashSeed(rawUrl) % 18000);
    priceEstimated = true;
  }

  const lat = getParam(params, ["lat", "latitude"]);
  const lng = getParam(params, ["lng", "lon", "longitude"]);
  let map = getParam(params, ["map", "mapUrl", "googleMap"]);

  if (!map) {
    if (lat && lng) {
      map = `https://www.google.com/maps?q=${lat},${lng}`;
    } else {
      map = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${area} ${name}`)}`;
    }
  }

  const nights = calcNights(checkin, checkout);

  return {
    id: crypto.randomUUID(),
    checkin,
    checkout,
    nights,
    area,
    people: Number.isFinite(people) && people > 0 ? people : 2,
    name,
    site,
    price,
    total: price * nights,
    map,
    url: rawUrl,
    priceEstimated,
    candidates: [],
  };
}

function sortHotels(list) {
  const sorted = [...list];
  if (els.hotelSort.value === "price-desc") {
    sorted.sort((a, b) => b.price - a.price);
  } else {
    sorted.sort((a, b) => a.price - b.price);
  }
  return sorted;
}

function isHotelSelectedForActiveDay(hotel) {
  const points = (state.transportPlan?.points || []).map(ensurePointObject);
  const destination = points.find((p) => p.isDestination);
  if (!destination) return false;
  if (destination.url && hotel.url) {
    return destination.url === hotel.url;
  }
  return destination.name.trim() === hotel.name.trim();
}

function renderHotelResults() {
  if (!state.hotels.length) {
    els.hotelResults.innerHTML = "<div class='hotel-empty'>登録がありません</div>";
    return;
  }

  const sorted = sortHotels(state.hotels);
  els.hotelResults.innerHTML = sorted
    .map((h) => {
      const isSelected = isHotelSelectedForActiveDay(h);
      const isExpanded = Boolean(state.hotelExpanded[h.id]);
      const selectedClass = isSelected ? "is-selected" : "is-unselected";
      return `
        <article class="hotel-choice-item">
          <div class="hotel-choice-row">
            <button type="button" class="ghost tiny hotel-toggle-btn" data-toggle-hotel-panel="${h.id}" aria-label="宿詳細開閉">${isExpanded ? "▼" : "▶"}</button>
            <input type="text" class="hotel-name-input" data-hotel-name-input="${h.id}" value="${escapeHtml(h.name)}" />
            <button type="button" class="tiny hotel-select-btn ${selectedClass}" data-set-hotel-destination="${h.id}">SELECT</button>
            <button type="button" class="ghost tiny" data-delete-hotel="${h.id}">削除</button>
          </div>
          <div class="hotel-choice-detail ${isExpanded ? "" : "hidden"}">
            <div class="hotel-detail-summary">
              <button type="button" class="ghost tiny" data-search-hotel-name="${h.id}">名称候補検索</button>
              <button type="button" class="ghost tiny" data-close-hotel-candidates="${h.id}">候補を閉じる</button>
              <span>宿泊見積：<strong>¥${h.total.toLocaleString()}</strong>（${h.nights}泊）</span>
              <span>/</span>
              <span>${h.people}名</span>
            </div>
            ${
              Array.isArray(h.candidates) && h.candidates.length
                ? `<div class="hotel-name-candidates">
                    ${h.candidates
                      .map(
                        (candidate) =>
                          `<button type="button" class="ghost tiny" data-apply-hotel-candidate="${h.id}" data-candidate-name="${encodeURIComponent(candidate)}">${escapeHtml(candidate)}</button>`,
                      )
                      .join("")}
                  </div>`
                : ""
            }
            <div class="hotel-detail-actions">
              <a class="hotel-action-btn" href="${h.url}" target="_blank" rel="noopener noreferrer">${escapeHtml(h.site)}</a>
              <button type="button" class="hotel-action-btn" data-google-search-hotel="${h.id}">Google検索</button>
              <a class="hotel-action-btn" href="${h.map}" target="_blank" rel="noopener noreferrer">MAP</a>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderSelectedHotel() {
  if (!els.selectedHotel) return;
  if (!state.selectedHotel) {
    els.selectedHotel.textContent = "リストから1件選択してください。";
    els.selectedHotel.classList.add("muted");
    return;
  }

  const h = state.selectedHotel;
  const areaLabel = isUnknownArea(h.area) ? "エリア情報なし" : h.area;
  els.selectedHotel.classList.remove("muted");
  els.selectedHotel.innerHTML = `
    <strong>${h.name}</strong> (${h.site})<br />
    ${areaLabel} / ${h.checkin} 〜 ${h.checkout} / ${h.people}名 / ${h.nights}泊<br />
    1泊: ¥${h.price.toLocaleString()}${h.priceEstimated ? " (推定)" : ""} / 宿泊見積: ¥${h.total.toLocaleString()}<br />
    <a href="${h.map}" target="_blank" rel="noopener noreferrer">地図を開く</a> ・
    <a href="${h.url}" target="_blank" rel="noopener noreferrer">宿ページを開く</a>
  `;
}

function updateHotelNameById(hotelId, nextNameRaw, options = {}) {
  const { silent = false } = options;
  const target = state.hotels.find((hotel) => hotel.id === hotelId);
  if (!target) return;
  const nextName = (nextNameRaw || "").trim();
  if (!nextName) {
    if (!silent) {
      setStatus("宿名を入力してください。", true);
    }
    return;
  }

  const prevName = target.name;
  state.hotels = state.hotels.map((hotel) => (hotel.id === hotelId ? { ...hotel, name: nextName } : hotel));
  const updated = state.hotels.find((hotel) => hotel.id === hotelId);
  if (state.selectedHotel && state.selectedHotel.id === hotelId) {
    state.selectedHotel = { ...state.selectedHotel, name: nextName };
    syncDestinationWithHotel(state.selectedHotel);
  }
  if (updated) {
    renameHotelUrlHistoryEntry(updated.url, nextName);
  }
  replacePlaceHistoryName(prevName, nextName);
  savePlaceHistory(nextName);
  renderHotelResults();
  renderSelectedHotel();
  if (!silent) {
    setStatus(`宿名を「${prevName}」から「${nextName}」へ変更しました。`);
  }
}

function commitPendingSelectedHotelName() {
  if (!state.selectedHotel) return;
  const input = document.querySelector(`input[data-hotel-name-input="${state.selectedHotel.id}"]`);
  if (!input) return;
  const pending = input.value.trim();
  if (pending && pending !== state.selectedHotel.name) {
    updateHotelNameById(state.selectedHotel.id, pending, { silent: true });
  }
}

function syncDestinationWithHotel(hotel) {
  if (!hotel) return;
  const destination = [isUnknownArea(hotel.area) ? "" : hotel.area, hotel.name].filter(Boolean).join(" ").trim();
  if (!destination) return;

  normalizeRoutePoints();
  const destinationIndex = state.transportPlan.points.findIndex((p) => ensurePointObject(p).isDestination);

  if (destinationIndex >= 0) {
    const current = ensurePointObject(state.transportPlan.points[destinationIndex]);
    state.transportPlan.points[destinationIndex] = {
      ...current,
      name: destination,
      url: hotel.url || "",
      isDestination: true,
    };
  } else {
    state.transportPlan.points.push({
      name: destination,
      url: hotel.url || "",
      candidates: [],
      isDestination: true,
    });
  }

  normalizeRoutePoints();
  renderRouteList();
  renderTransportDetail();
  if (els.destinationInput) {
    els.destinationInput.value = destination;
  }
}

function syncDestinationFromInput(destinationName, options = {}) {
  const { saveHistory = true } = options;
  const normalized = (destinationName || "").trim();
  if (!normalized) return;

  normalizeRoutePoints();
  const destinationIndex = state.transportPlan.points.findIndex((p) => ensurePointObject(p).isDestination);
  if (destinationIndex >= 0) {
    const current = ensurePointObject(state.transportPlan.points[destinationIndex]);
    state.transportPlan.points[destinationIndex] = {
      ...current,
      name: normalized,
      isDestination: true,
    };
  } else {
    state.transportPlan.points.push({
      name: normalized,
      url: "",
      candidates: [],
      isDestination: true,
    });
  }

  normalizeRoutePoints();
  if (saveHistory) {
    savePlaceHistory(normalized);
  }
  renderRouteList();
  renderTransportDetail();
}

function moveRoutePoint(fromIndex, toIndex) {
  normalizeRoutePoints();

  if (fromIndex === toIndex) return;
  if (fromIndex < 0 || toIndex < 0) return;
  if (fromIndex >= state.transportPlan.points.length || toIndex >= state.transportPlan.points.length) return;

  const moved = state.transportPlan.points.splice(fromIndex, 1)[0];
  state.transportPlan.points.splice(toIndex, 0, moved);
  normalizeRoutePoints();
}

function movePointToAnotherDay(fromDay, pointIndex, toDay) {
  if (!Number.isInteger(fromDay) || !Number.isInteger(toDay)) return false;
  if (fromDay === toDay) return false;
  const fromPlan = state.transportDays[fromDay];
  const toPlan = state.transportDays[toDay];
  if (!fromPlan || !toPlan) return false;
  if (!Number.isInteger(pointIndex) || pointIndex < 0 || pointIndex >= fromPlan.points.length) return false;

  const moving = ensurePointObject(fromPlan.points[pointIndex]);
  const movingName = moving.name;
  const movingUrl = moving.url || "";
  fromPlan.points.splice(pointIndex, 1);
  toPlan.points.push({ ...moving, isDestination: false });

  normalizePlanPoints(fromPlan);
  normalizePlanPoints(toPlan);

  const reflected = toPlan.points.some((p) => {
    const normalized = ensurePointObject(p);
    return normalized.name === movingName && (normalized.url || "") === movingUrl;
  });
  return reflected;
}

function ensurePointObject(point) {
  if (typeof point === "string") {
    return { name: point, url: "", candidates: [], isDestination: false, expanded: false };
  }
  return {
    name: point?.name || "",
    url: point?.url || "",
    candidates: Array.isArray(point?.candidates) ? point.candidates : [],
    isDestination: Boolean(point?.isDestination),
    expanded: Boolean(point?.expanded),
  };
}

function normalizeRoutePoints() {
  normalizePlanPoints(state.transportPlan);
}

function normalizePlanPoints(plan) {
  if (!plan) return;
  const points = (plan.points || []).map(ensurePointObject);
  if (!points.length) {
    plan.points = [];
    return;
  }
  const normalized = points.map((p) => ({ ...p, isDestination: false }));
  normalized[normalized.length - 1] = { ...normalized[normalized.length - 1], isDestination: true };
  plan.points = normalized;
}

function normalizeCandidate(text) {
  return decodeURIComponent(String(text || ""))
    .replace(/\+/g, " ")
    .replace(/[?#].*$/, "")
    .replace(/\.(html|htm|php|aspx?)$/i, "")
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractNameCandidatesFromUrl(rawUrl) {
  const value = String(rawUrl || "").trim();
  if (!value) return [];

  let urlObj;
  try {
    urlObj = new URL(value);
  } catch {
    return [];
  }

  const chunks = [];
  const params = urlObj.searchParams;
  ["q", "query", "destination", "origin", "place", "name", "text", "daddr", "saddr"].forEach((key) => {
    const paramValue = params.get(key);
    if (paramValue) chunks.push(paramValue);
  });

  urlObj.pathname
    .split("/")
    .map((part) => decodeURIComponent(part || ""))
    .filter(Boolean)
    .forEach((part) => chunks.push(part));

  const prepared = chunks
    .flatMap((chunk) => String(chunk).split(/[|,/]/))
    .map((item) => normalizeCandidate(item))
    .map((item) => item.replace(/^\+?\d+(?:\.\d+)?\s*,\s*\+?\d+(?:\.\d+)?$/, ""))
    .map((item) => item.replace(/\b(map|maps|place|search|dir|route|api)\b/gi, "").trim())
    .filter((item) => item.length >= 2);

  return [...new Set(prepared)].slice(0, 8);
}

async function fetchGoogleSuggestions(query) {
  // Use JSONP instead of fetch to avoid browser CORS restrictions.
  return new Promise((resolve, reject) => {
    const callbackName = `__nttGoogleSuggest_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const endpoint = `https://suggestqueries.google.com/complete/search?client=chrome&hl=ja&q=${encodeURIComponent(query)}&callback=${callbackName}`;
    const script = document.createElement("script");
    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error("suggest timeout"));
    }, 7000);

    function cleanup() {
      window.clearTimeout(timeoutId);
      delete window[callbackName];
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    }

    window[callbackName] = (data) => {
      cleanup();
      if (!Array.isArray(data) || !Array.isArray(data[1])) {
        resolve([]);
        return;
      }

      resolve(
        data[1]
          .map((item) => normalizeCandidate(item))
          .filter((item) => item.length >= 2)
          .slice(0, 6),
      );
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("suggest script failed"));
    };
    script.src = endpoint;
    document.head.appendChild(script);
  });
}

function getTransportModel() {
  const origin = (state.transportPlan?.origin || "").trim();
  normalizeRoutePoints();
  const points = state.transportPlan.points.map(ensurePointObject);
  const destinationPoint = points.find((p) => p.isDestination) || points[points.length - 1];
  const destination = destinationPoint ? destinationPoint.name : "";

  if (!origin || !destination) return null;

  const waypoints = points.filter((p) => p !== destinationPoint).map((p) => p.name);
  const path = [origin, ...waypoints, destination].map((p) => encodeURIComponent(p)).join("/");
  const mapsUrl = `https://www.google.com/maps/dir/${path}`;

  return {
    category: "車",
    name: "車ルート登録",
    origin,
    destination,
    waypoints,
    price: 0,
    time: 0,
    mapsUrl,
  };
}

function buildRouteSegments(plan = state.transportPlan) {
  const origin = (plan?.origin || "").trim();
  if (!plan) return [];
  const pointsRaw = plan.points || [];
  const pointsNormalized = pointsRaw.map(ensurePointObject);
  const destinations = pointsNormalized.filter((p) => p.isDestination);
  const waypointsOnly = pointsNormalized.filter((p) => !p.isDestination);
  const points = destinations.length ? [...waypointsOnly, destinations[destinations.length - 1]] : waypointsOnly;
  const destinationPoint = points.find((p) => p.isDestination) || points[points.length - 1];
  const waypointNames = points.filter((p) => p !== destinationPoint).map((p) => p.name.trim()).filter(Boolean);
  const destinationName = destinationPoint?.name?.trim() || "";
  const nodes = [origin, ...waypointNames, destinationName].filter((name) => name);
  if (nodes.length < 2) return [];

  return nodes.slice(0, -1).map((from, index) => {
    const to = nodes[index + 1];
    return {
      index,
      from,
      to,
      mapsUrl: `https://www.google.com/maps/dir/${encodeURIComponent(from)}/${encodeURIComponent(to)}`,
    };
  });
}

function renderSegmentDetail(segment) {
  if (!els.transportDetail) return;
  if (!segment) return;
  els.transportDetail.classList.remove("muted");
  els.transportDetail.innerHTML = `
    <strong>区間ルート</strong><br />
    ${segment.from} → ${segment.to}<br />
    <a href="${segment.mapsUrl}" target="_blank" rel="noopener noreferrer">Google Mapsで区間ルートを表示</a>
  `;
}

function setActiveDay(dayIndex) {
  if (!Number.isInteger(dayIndex)) return;
  if (dayIndex < 0 || dayIndex >= state.transportDays.length) return;
  state.activeDayIndex = dayIndex;
  const title = document.querySelector("#day-sections > .card > .section-head h2");
  if (title) {
    title.textContent = `DAY${dayIndex + 1}`;
  }
  els.originInput.value = state.transportPlan.origin || "";
  if (els.destinationInput) {
    const destinationPoint = (state.transportPlan.points || [])
      .map(ensurePointObject)
      .find((point) => point.isDestination);
    els.destinationInput.value = destinationPoint?.name || "";
  }
  saveTransportState();
}

function renumberDaySectionTitles() {
  const daySections = document.getElementById("day-sections");
  if (!daySections) return;
  const cards = Array.from(daySections.querySelectorAll(":scope > .card"));
  cards.forEach((card, idx) => {
    const title = card.querySelector(".section-head h2");
    if (title) {
      title.textContent = `DAY${idx + 1}`;
    }
  });
}

function ensureDayCardAccordionStructure() {
  const daySections = document.getElementById("day-sections");
  if (!daySections) return [];
  const cards = Array.from(daySections.querySelectorAll(":scope > .card"));
  cards.forEach((card, index) => {
    card.dataset.dayCardIndex = String(index);
    const head = card.querySelector(":scope > .section-head");
    if (!head) return;

    let dayTitle = head.querySelector(".day-title");
    if (!dayTitle) {
      dayTitle = document.createElement("div");
      dayTitle.className = "day-title";
      const title = head.querySelector("h2");
      if (title) {
        head.insertBefore(dayTitle, title);
        dayTitle.appendChild(title);
      } else {
        head.prepend(dayTitle);
      }
    }

    let tools = head.querySelector(".input-tools");
    if (!tools) {
      tools = document.createElement("div");
      tools.className = "input-tools day-actions";
      head.appendChild(tools);
    } else {
      tools.classList.add("day-actions");
    }
    let toggle = head.querySelector(".day-accordion-toggle");
    if (!toggle) {
      toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "ghost tiny day-accordion-toggle icon-btn";
      dayTitle.prepend(toggle);
    } else if (toggle.parentElement !== dayTitle) {
      dayTitle.prepend(toggle);
    }
    toggle.setAttribute("aria-label", "DAY開閉");
    toggle.setAttribute("title", "DAY開閉");

    if (!tools.querySelector(".day-export-btn")) {
      const exportBtn = document.createElement("button");
      exportBtn.type = "button";
      exportBtn.className = "ghost tiny day-export-btn icon-btn";
      exportBtn.textContent = "↑";
      exportBtn.setAttribute("aria-label", "書き出し");
      exportBtn.setAttribute("title", "書き出し");
      tools.appendChild(exportBtn);
    }
    if (!tools.querySelector(".day-import-btn")) {
      const importBtn = document.createElement("button");
      importBtn.type = "button";
      importBtn.className = "ghost tiny day-import-btn icon-btn";
      importBtn.textContent = "↓";
      importBtn.setAttribute("aria-label", "読み込み");
      importBtn.setAttribute("title", "読み込み");
      tools.appendChild(importBtn);
    }
    if (!card.querySelector(".day-import-file")) {
      const importFile = document.createElement("input");
      importFile.type = "file";
      importFile.className = "day-import-file hidden";
      importFile.accept = "application/json,.json";
      card.appendChild(importFile);
    }

    let body = card.querySelector(":scope > .day-card-body");
    if (!body) {
      body = document.createElement("div");
      body.className = "day-card-body";
      const moveTargets = Array.from(card.children).filter((child) => child !== head);
      moveTargets.forEach((child) => body.appendChild(child));
      card.appendChild(body);
    }

    const originInput = card.querySelector("#origin, input[list='origin-history']");
    if (originInput) originInput.dataset.dayRole = "origin-input";
    const destinationInput = card.querySelector("#destination-input, input[placeholder*='天城温泉']");
    if (destinationInput) destinationInput.dataset.dayRole = "destination-input";
    const routeList = card.querySelector("#route-list, .box.muted");
    if (routeList) routeList.dataset.dayRole = "route-list";
    const detailBox = card.querySelector("#transport-detail, [data-day-role='transport-detail']");
    if (detailBox) detailBox.dataset.dayRole = "transport-detail";
  });
  return cards;
}

function setDayCardOpen(card, isOpen) {
  const body = card.querySelector(":scope > .day-card-body");
  const toggle = card.querySelector(".day-accordion-toggle");
  if (body) {
    body.classList.toggle("hidden", !isOpen);
  }
  if (toggle) {
    toggle.textContent = isOpen ? "▼" : "▶";
    toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
  }
}

function isDayCardOpen(card) {
  const body = card.querySelector(":scope > .day-card-body");
  return body ? !body.classList.contains("hidden") : false;
}

function setupDayAccordionDefaults() {
  const cards = ensureDayCardAccordionStructure();
  if (!cards.length) return;
  cards.forEach((card, idx) => {
    setDayCardOpen(card, idx === 0);
  });
}

function collectFieldStates(container) {
  return Array.from(container.querySelectorAll("input, select, textarea")).map((field) => {
    const base = {
      tag: field.tagName.toLowerCase(),
      type: field instanceof HTMLInputElement ? field.type : "",
      value: field.value ?? "",
      checked: field instanceof HTMLInputElement ? field.checked : false,
    };
    return base;
  });
}

function applyFieldStates(container, fields) {
  const targets = Array.from(container.querySelectorAll("input, select, textarea"));
  const limit = Math.min(targets.length, fields.length);
  for (let i = 0; i < limit; i += 1) {
    const target = targets[i];
    const source = fields[i];
    if (!source) continue;
    if (target instanceof HTMLInputElement && (target.type === "checkbox" || target.type === "radio")) {
      target.checked = Boolean(source.checked);
    } else {
      target.value = source.value ?? "";
    }
  }
}

function createDaySnapshot(card) {
  const title = card.querySelector(".section-head h2")?.textContent?.trim() || "日目";
  const body = card.querySelector(":scope > .day-card-body") || card;
  const routeList = card.querySelector("[data-day-role='route-list']");
  const transportDetail = card.querySelector("[data-day-role='transport-detail']");
  return {
    schema: "ntt-day-route-v1",
    title,
    open: isDayCardOpen(card),
    fields: collectFieldStates(body),
    routeListHtml: routeList ? routeList.innerHTML : "",
    transportDetailHtml: transportDetail ? transportDetail.innerHTML : "",
  };
}

function applyDaySnapshot(card, snapshot) {
  const body = card.querySelector(":scope > .day-card-body") || card;
  applyFieldStates(body, Array.isArray(snapshot.fields) ? snapshot.fields : []);
  const routeList = card.querySelector("[data-day-role='route-list']");
  const transportDetail = card.querySelector("[data-day-role='transport-detail']");
  if (routeList && typeof snapshot.routeListHtml === "string") {
    routeList.innerHTML = snapshot.routeListHtml;
    routeList.classList.remove("muted");
  }
  if (transportDetail && typeof snapshot.transportDetailHtml === "string") {
    transportDetail.innerHTML = snapshot.transportDetailHtml;
    transportDetail.classList.remove("muted");
  }
  setDayCardOpen(card, Boolean(snapshot.open));
}

function cloneCardInputValues(sourceCard, clonedCard) {
  const sourceFields = sourceCard.querySelectorAll("input, select, textarea");
  const clonedFields = clonedCard.querySelectorAll("input, select, textarea");
  const length = Math.min(sourceFields.length, clonedFields.length);
  for (let i = 0; i < length; i += 1) {
    const src = sourceFields[i];
    const dst = clonedFields[i];
    if (src instanceof HTMLInputElement) {
      if (src.type === "checkbox" || src.type === "radio") {
        dst.checked = src.checked;
      } else {
        dst.value = src.value;
      }
      continue;
    }
    dst.value = src.value;
  }
}

function resetDayCardInputs(card) {
  const fields = card.querySelectorAll("input, select, textarea");
  fields.forEach((field) => {
    if (field instanceof HTMLInputElement) {
      if (field.type === "button" || field.type === "submit" || field.type === "file") return;
      if (field.type === "checkbox" || field.type === "radio") {
        field.checked = false;
      } else {
        field.value = "";
      }
      return;
    }
    if (field instanceof HTMLSelectElement) {
      field.selectedIndex = 0;
      return;
    }
    field.value = "";
  });

  card.querySelectorAll(".route-history-dropdown, #origin-history-dropdown, #destination-history-dropdown, #hotel-url-history-dropdown").forEach((el) => {
    el.classList.add("hidden");
  });

  const hotelResults =
    card.querySelector("#hotel-results") || card.querySelector("[data-day-role='hotel-results']");
  if (hotelResults) {
    hotelResults.innerHTML = "<div class='hotel-empty'>登録がありません</div>";
  }

  const routeList = card.querySelector("#route-list") || card.querySelector("[data-day-role='route-list']") || card.querySelector(".box");
  if (routeList) {
    routeList.textContent = "出発地と経由地を登録してください。";
    routeList.classList.add("muted");
  }

  const detail = card.querySelector("#transport-detail") || card.querySelector("[data-day-role='transport-detail']");
  if (detail) {
    detail.textContent = "車ルート詳細はここに表示されます。";
    detail.classList.add("muted");
  }
}

function removeIdsFromCard(card) {
  card.querySelectorAll("[id]").forEach((element) => {
    element.removeAttribute("id");
  });
}

function addDaySectionFromCard(sourceCard) {
  const daySections = document.getElementById("day-sections");
  if (!daySections || !sourceCard) return;
  const sourceIndexRaw = Number(sourceCard.dataset.dayCardIndex);
  const sourceIndex =
    Number.isInteger(sourceIndexRaw) && sourceIndexRaw >= 0 && sourceIndexRaw < state.transportDays.length
      ? sourceIndexRaw
      : state.activeDayIndex;
  const newDayIndex = addRouteDay(sourceIndex);
  const clonedCard = sourceCard.cloneNode(true);
  resetDayCardInputs(clonedCard);
  removeIdsFromCard(clonedCard);
  daySections.insertBefore(clonedCard, sourceCard.nextSibling);
  renumberDaySectionTitles();
  setDayCardOpen(clonedCard, false);
  return newDayIndex;
}

function removeDaySectionByButton(button) {
  const daySections = document.getElementById("day-sections");
  if (!daySections) return;
  const cards = Array.from(daySections.querySelectorAll(":scope > .card"));
  if (cards.length <= 1) {
    setStatus("日ルートは最低1つ必要です。", true);
    return;
  }
  const targetCard = button.closest(".card");
  if (!targetCard) return;
  const removeIndexRaw = Number(targetCard.dataset.dayCardIndex);
  const removeIndex =
    Number.isInteger(removeIndexRaw) && removeIndexRaw >= 0 && removeIndexRaw < state.transportDays.length
      ? removeIndexRaw
      : state.activeDayIndex;
  if (state.transportDays.length > 1) {
    state.transportDays.splice(removeIndex, 1);
    if (state.activeDayIndex >= state.transportDays.length) {
      state.activeDayIndex = Math.max(0, state.transportDays.length - 1);
    }
  }
  targetCard.remove();
  renumberDaySectionTitles();
  ensureDayCardAccordionStructure();
  renderRouteList();
  renderTransportDetail();
  setStatus("DAYを削除しました。");
}

async function exportSingleDay(card) {
  if (!card) return;
  const index = Number(card.dataset.dayCardIndex || 0) + 1;
  const payload = createDaySnapshot(card);
  openExportChoiceModal(`route-day-${index}.json`, payload);
  setStatus(`${index}日目ルートの送信方法を選択してください。`);
}

function importSingleDay(card, payload) {
  if (!card) return;
  if (!payload || payload.schema !== "ntt-day-route-v1") {
    setStatus("読み込みファイル形式が正しくありません。", true);
    return;
  }
  applyDaySnapshot(card, payload);
  setStatus("日ルートを読み込みました。");
}

async function exportAllDays() {
  const payload = createAllDaysPayload();
  openExportChoiceModal("route-days-all.json", payload);
  setStatus("全日ルートの送信方法を選択してください。");
}

function importAllDays(payload) {
  if (!payload || payload.schema !== "ntt-day-routes-v1" || !Array.isArray(payload.days)) {
    setStatus("読み込みファイル形式が正しくありません。", true);
    return;
  }
  const daySections = document.getElementById("day-sections");
  if (!daySections) return;
  const currentCards = ensureDayCardAccordionStructure();
  currentCards.forEach((card, idx) => {
    if (idx > 0) card.remove();
  });

  let baseCard = ensureDayCardAccordionStructure()[0];
  payload.days.forEach((daySnapshot, idx) => {
    if (idx === 0) {
      importSingleDay(baseCard, daySnapshot);
      return;
    }
    addDaySectionFromCard(baseCard);
    const cards = ensureDayCardAccordionStructure();
    const targetCard = cards[idx];
    if (targetCard) {
      importSingleDay(targetCard, daySnapshot);
    }
    baseCard = cards[0];
  });
  renumberDaySectionTitles();
  ensureDayCardAccordionStructure();
  setStatus("全日ルートを読み込みました。");
}

function createAllDaysPayload() {
  const cards = ensureDayCardAccordionStructure();
  return {
    schema: "ntt-day-routes-v1",
    createdAt: new Date().toISOString(),
    days: cards.map((card) => createDaySnapshot(card)),
  };
}

function addRouteDay(afterDayIndex = null) {
  const newDay = {
    origin: "",
    points: [],
    expanded: false,
    segmentTimes: {},
  };
  let insertedIndex = state.transportDays.length;
  if (Number.isInteger(afterDayIndex) && afterDayIndex >= 0 && afterDayIndex < state.transportDays.length) {
    insertedIndex = afterDayIndex + 1;
    state.transportDays.splice(insertedIndex, 0, newDay);
  } else {
    state.transportDays.push(newDay);
    insertedIndex = state.transportDays.length - 1;
  }
  return insertedIndex;
}

function deleteRouteDay(dayIndex) {
  if (state.transportDays.length <= 1) {
    setStatus("ルートは最低1つ必要です。", true);
    return;
  }
  if (dayIndex < 0 || dayIndex >= state.transportDays.length) return;
  state.transportDays.splice(dayIndex, 1);
  setActiveDay(Math.max(0, Math.min(dayIndex, state.transportDays.length - 1)));
}

function normalizeAllDays() {
  state.transportDays.forEach((day, idx) => {
    normalizePlanPoints(day);
    if (typeof day.expanded !== "boolean") {
      day.expanded = idx === 0;
    }
    if (!day.segmentTimes || typeof day.segmentTimes !== "object" || Array.isArray(day.segmentTimes)) {
      day.segmentTimes = {};
    }
  });
}

function buildRouteListHtmlForDay(dayIndex) {
  const day = state.transportDays[dayIndex];
  if (!day) return "<li class='route-origin'>経由地または目的地を追加してください。</li>";
  const points = day.points.map(ensurePointObject);
  const destinationPoint = points.find((point) => point.isDestination) || points[points.length - 1];
  const destinationIndex = destinationPoint ? points.findIndex((point) => point === destinationPoint) : -1;
  const waypoints = points
    .map((point, sourceIndex) => ({ point, sourceIndex }))
    .filter(({ point, sourceIndex }) => !(point.isDestination || sourceIndex === points.length - 1));
  const rowHtmlList = waypoints.map(({ point, sourceIndex }) => {
    const moveDayOptions =
      state.transportDays.length > 1
        ? state.transportDays.map((_, idx) => `<option value="${idx}" ${idx === dayIndex ? "selected" : ""}>DAY${idx + 1}</option>`).join("")
        : `<option value="${dayIndex}" selected>DAY${dayIndex + 1}</option>`;
    const key = `${dayIndex}:${sourceIndex}`;
    const isEmptyWaypoint = !(point.name || "").trim();
    return `
      <li class="route-item route-waypoint-item ${isEmptyWaypoint ? "is-empty-waypoint" : ""}" draggable="true" data-day-index="${dayIndex}" data-index="${sourceIndex}">
        <div class="route-waypoint-head">
          <span class="drag-handle">⠿</span>
          <button type="button" class="ghost tiny route-toggle-btn" data-toggle-point="${key}" aria-label="経由地開閉">${point.expanded ? "▼" : "▶"}</button>
          <input type="text" class="route-point-input" data-point-input="${dayIndex}:${sourceIndex}" value="${point.name}" placeholder="経由地を入力" />
          <button type="button" class="tiny route-btn-black" data-remove-point="${dayIndex}:${sourceIndex}" aria-label="削除">×</button>
        </div>
        <div class="route-waypoint-body ${point.expanded ? "" : "hidden"}">
          <div class="route-history-tools route-waypoint-history-tools">
            <button type="button" class="ghost tiny" data-open-history="${key}">履歴から</button>
            <button type="button" class="ghost tiny" data-edit-history="${key}">☰</button>
            <input type="url" class="route-url-input" data-point-url="${dayIndex}:${sourceIndex}" value="${point.url || ""}" placeholder="参考 URL" />
          </div>
          <div class="route-history-dropdown ${state.activeHistoryDropdownIndex === key ? "" : "hidden"}">
            ${
              state.placeHistory.length
                ? state.placeHistory
                    .slice(0, 12)
                    .map((historyName) => `<button type="button" class="ghost tiny" data-use-history="${key}" data-history-name="${encodeURIComponent(historyName)}">${historyName}</button>`)
                    .join("")
                : "<span class='muted'>履歴がありません</span>"
            }
          </div>
          <div class="route-actions route-waypoint-actions">
            <button type="button" class="tiny route-btn-black" data-url-suggest="${dayIndex}:${sourceIndex}">MAPから</button>
            <button type="button" class="tiny ${point.candidates.length ? "route-btn-green-active" : "route-btn-green"}" data-google-suggest="${dayIndex}:${sourceIndex}">${point.candidates.length ? "閉じる" : "名称候補"}</button>
            <button type="button" class="tiny route-btn-black" data-google-search="${dayIndex}:${sourceIndex}">Google検索</button>
          </div>
          <div class="route-candidates">
            ${
              point.candidates.length
                ? point.candidates
                    .map((candidate) => `<button type="button" class="ghost tiny" data-apply-candidate="${dayIndex}:${sourceIndex}" data-candidate-name="${encodeURIComponent(candidate)}">${candidate}</button>`)
                    .join("")
                : ""
            }
          </div>
          <div class="route-actions route-waypoint-move-row">
            <select class="tiny" data-move-day-select="${dayIndex}:${sourceIndex}">${moveDayOptions}</select>
            <button type="button" class="tiny route-btn-black" data-move-to-day="${dayIndex}:${sourceIndex}">別日に移動</button>
            <button type="button" class="ghost tiny route-head-icon" data-move-up="${dayIndex}:${sourceIndex}">↑</button>
            <button type="button" class="ghost tiny route-head-icon" data-move-down="${dayIndex}:${sourceIndex}">↓</button>
          </div>
        </div>
      </li>
    `;
  });

  let routeItemsHtml = "";
  let segmentVisualIndex = 0;
  const renderSegmentRow = (fromName, toName, insertAtIndex) => {
    const from = (fromName || "").trim();
    const to = (toName || "").trim();
    const canOpen = Boolean(from && to);
    const reason = canOpen ? "" : "区間の出発地/到着地を入力すると開けます。";
    const manualTimeValue = getSegmentManualTime(dayIndex, segmentVisualIndex);
    const optionsHtml = buildSegmentTimeOptions(manualTimeValue);
    const segmentHtml = `
      <li class="route-segment-only">
        ${
          canOpen
            ? `<button type="button" class="ghost tiny" data-open-segment-from="${encodeURIComponent(from)}" data-open-segment-to="${encodeURIComponent(to)}">G Map</button>
               <button type="button" class="ghost tiny" data-open-segment-yahoo-from="${encodeURIComponent(from)}" data-open-segment-yahoo-to="${encodeURIComponent(to)}">Y Nav</button>`
            : `<button type="button" class="ghost tiny" data-open-segment-disabled data-segment-reason="${reason}">G Map</button>
               <button type="button" class="ghost tiny" data-open-segment-yahoo-disabled data-segment-reason="${reason}">Y Nav</button>`
        }
        <span class="route-segment-time">${getDriveTimeLabel(from, to)}</span>
        <select class="tiny route-segment-time-select" data-segment-time-select="${dayIndex}:${segmentVisualIndex}">
          ${optionsHtml}
        </select>
        <button type="button" class="ghost tiny" data-add-waypoint-at="${dayIndex}:${insertAtIndex}">追加</button>
      </li>
    `;
    segmentVisualIndex += 1;
    return segmentHtml;
  };

  let fromName = (day.origin || "").trim();
  waypoints.forEach(({ point, sourceIndex }, idx) => {
    const waypointName = (point.name || "").trim();
    if (waypointName) {
      routeItemsHtml += renderSegmentRow(fromName, waypointName, sourceIndex);
      fromName = waypointName;
    }
    routeItemsHtml += rowHtmlList[idx] || "";
  });

  if (destinationPoint) {
    const goalInsertIndex = destinationIndex >= 0 ? destinationIndex : points.length;
    routeItemsHtml += renderSegmentRow(fromName, destinationPoint.name, goalInsertIndex);
  }

  return routeItemsHtml || "<li class='route-origin'>経由地または目的地を追加してください。</li>";
}

function renderRouteList() {
  if (!state.transportDays.length) {
    els.routeList.textContent = "DAYを追加してください。";
    els.routeList.classList.add("muted");
    saveTransportState();
    return;
  }
  normalizeAllDays();
  const dayIndex = state.activeDayIndex;
  const routeItemsHtml = buildRouteListHtmlForDay(dayIndex);
  els.routeList.classList.remove("muted");
  els.routeList.innerHTML = `<ul class="route-items" data-day-dropzone="${dayIndex}">${routeItemsHtml}</ul>`;
  setActiveDay(state.activeDayIndex);
  saveTransportState();
}

function renderRouteListIntoDayCard(dayIndex) {
  const cards = ensureDayCardAccordionStructure();
  const card = cards[dayIndex];
  if (!card) return;
  const target = card.querySelector("[data-day-role='route-list']");
  if (!target) return;
  const routeItemsHtml = buildRouteListHtmlForDay(dayIndex);
  target.classList.remove("muted");
  target.innerHTML = `<ul class="route-items" data-day-dropzone="${dayIndex}">${routeItemsHtml}</ul>`;
}

function renderTransportDetail() {
  if (!els.transportDetail) return;
  const transport = getTransportModel();
  if (!transport) {
    els.transportDetail.textContent = "全体ルートのGoogleMapはここに表示されます。";
    els.transportDetail.classList.add("muted");
    return;
  }

  els.transportDetail.classList.remove("muted");
  els.transportDetail.innerHTML = `
    <strong>全体ルート</strong><br />
    ${transport.origin} → ${transport.destination}<br />
    経由地: ${transport.waypoints.length ? transport.waypoints.join(" / ") : "なし"}<br />
    <button type="button" class="ghost tiny" data-open-full-route>GoogleMapで全体ルートを表示</button>
    <button type="button" class="ghost tiny" data-open-full-route-yahoo>Yahooカーナビで全体ルートを表示</button>
  `;
}

function renderSpots() {
  if (!els.spotList) return;
  if (!state.spots.length) {
    els.spotList.textContent = "まだ登録がありません。";
    els.spotList.classList.add("muted");
    return;
  }

  els.spotList.classList.remove("muted");
  els.spotList.innerHTML = state.spots
    .map(
      (s, idx) => `
      <div>
        <strong>${idx + 1}. [${s.type}] ${s.name}</strong> (¥${s.cost.toLocaleString()})<br />
        地図: <a href="${s.map}" target="_blank" rel="noopener noreferrer">${s.map}</a><br />
        URL: ${s.url ? `<a href="${s.url}" target="_blank" rel="noopener noreferrer">${s.url}</a>` : "-"}<br />
        備考: ${s.memo || "-"}
      </div>
    `,
    )
    .join("<hr />");
}

function renderHistory() {
  if (!els.history) return;
  if (!state.history.length) {
    els.history.textContent = "履歴はまだありません。";
    els.history.classList.add("muted");
    return;
  }

  els.history.classList.remove("muted");
  els.history.innerHTML = state.history
    .map(
      (h, idx) => `
      <div>
        <strong>${idx + 1}. ${h.createdAt}</strong><br />
        ${h.origin} → ${h.destination} / 合計 ¥${h.total.toLocaleString()}<br />
        宿: ${h.hotel.name} (${h.hotel.site}) / 交通: ${h.transport.category} ${h.transport.name}
      </div>
    `,
    )
    .join("<hr />");
}

function handleHotelRegisterSubmit(formEl) {
  if (!formEl) return;
  const urlInput =
    formEl.querySelector("input[data-day-role='hotel-url-input']") ||
    formEl.querySelector("#hotelUrl");
  if (!urlInput) return;

  const hotelUrl = urlInput.value.trim();
  const historyEntry = state.hotelUrlHistory.find((entry) => entry.url === hotelUrl);
  const item = buildHotelFromUrl(hotelUrl, historyEntry?.name || "");

  if (!item) {
    setStatus("有効な宿URLを入力してください。", true);
    return false;
  }

  state.hotels.push(item);
  if (!state.selectedHotel) {
    state.selectedHotel = item;
    syncDestinationWithHotel(item);
  }

  renderHotelResults();
  renderSelectedHotel();
  saveHotelUrlHistory(hotelUrl, item.name);
  savePlaceHistory(item.name);
  closeTopHistoryDropdowns();
  closeAllDayHistoryDropdowns();
  formEl.reset();

  const note = item.priceEstimated ? "料金はURLから取得できなかったため推定値です。" : "";
  setStatus(`「${item.name} (${item.site})」をURLから自動登録しました。${note}`.trim());
  return true;
}

if (els.hotelForm) {
  els.hotelForm.addEventListener("submit", (e) => {
    e.preventDefault();
    handleHotelRegisterSubmit(els.hotelForm);
  });
}

document.addEventListener("submit", (e) => {
  const form = e.target.closest("form");
  if (!form || form.id === "hotel-register-form") return;
  const hasHotelUrlField = form.querySelector("input[data-day-role='hotel-url-input']");
  if (!hasHotelUrlField) return;
  e.preventDefault();
  handleHotelRegisterSubmit(form);
});

els.hotelSort.addEventListener("change", renderHotelResults);

els.hotelResults.addEventListener("click", (e) => {
  const toggleBtn = e.target.closest("button[data-toggle-hotel-panel]");
  if (toggleBtn) {
    const hotelId = toggleBtn.dataset.toggleHotelPanel;
    if (!hotelId) return;
    state.hotelExpanded[hotelId] = !state.hotelExpanded[hotelId];
    renderHotelResults();
    return;
  }

  const setBtn = e.target.closest("button[data-set-hotel-destination]");
  if (setBtn) {
    const hotelId = setBtn.dataset.setHotelDestination;
    const selected = state.hotels.find((h) => h.id === hotelId);
    if (!selected) return;
    state.selectedHotel = selected;
    syncDestinationWithHotel(selected);
    renderHotelResults();
    renderSelectedHotel();
    setStatus(`目的地を「${selected.name}」に設定しました。`);
    return;
  }

  const deleteBtn = e.target.closest("button[data-delete-hotel]");
  if (!deleteBtn) return;
  const hotelId = deleteBtn.dataset.deleteHotel;
  const target = state.hotels.find((h) => h.id === hotelId);
  if (!target) return;

  state.hotels = state.hotels.filter((h) => h.id !== hotelId);
  delete state.hotelExpanded[hotelId];
  if (state.selectedHotel && state.selectedHotel.id === hotelId) {
    state.selectedHotel = state.hotels[0] || null;
  }

  renderHotelResults();
  renderSelectedHotel();
  setStatus(`「${target.name}」を削除しました。`);
});

if (els.selectedHotel) {
  els.selectedHotel.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-update-selected-hotel-name]");
    if (!btn) return;
    const input = document.getElementById("selected-hotel-name-input");
    updateHotelNameById(state.selectedHotel?.id, input ? input.value : "");
  });
}

els.hotelResults.addEventListener("click", (e) => {
  const googleBtn = e.target.closest("button[data-google-search-hotel]");
  if (googleBtn) {
    const hotelId = googleBtn.dataset.googleSearchHotel;
    const hotel = state.hotels.find((item) => item.id === hotelId);
    const query = (hotel?.name || "").trim();
    if (!query) {
      setStatus("検索する宿名を入力してください。", true);
      return;
    }
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    window.open(searchUrl, "_blank", "noopener,noreferrer");
    return;
  }

  const searchBtn = e.target.closest("button[data-search-hotel-name]");
  if (searchBtn) {
    const hotelId = searchBtn.dataset.searchHotelName;
    const hotel = state.hotels.find((item) => item.id === hotelId);
    const name = (hotel?.name || "").trim();
    if (!name) {
      setStatus("Google検索候補を取るには、先に宿名を入力してください。", true);
      return;
    }
    setStatus("Google検索候補を取得中です...");
    fetchGoogleSuggestions(name)
      .then((candidates) => {
        state.hotels = state.hotels.map((item) =>
          item.id === hotelId ? { ...item, candidates: Array.isArray(candidates) ? candidates : [] } : item,
        );
        renderHotelResults();
        setStatus(
          candidates.length
            ? "Google検索候補を取得しました。候補を押すと宿名を置換できます。"
            : "Google検索候補が見つかりませんでした。",
          !candidates.length,
        );
      })
      .catch(() => {
        setStatus("Google検索候補の取得に失敗しました。時間を置いて再試行してください。", true);
      });
    return;
  }

  const closeBtn = e.target.closest("button[data-close-hotel-candidates]");
  if (closeBtn) {
    const hotelId = closeBtn.dataset.closeHotelCandidates;
    state.hotels = state.hotels.map((item) => (item.id === hotelId ? { ...item, candidates: [] } : item));
    renderHotelResults();
    setStatus("Google検索候補を閉じました。");
    return;
  }

  const applyBtn = e.target.closest("button[data-apply-hotel-candidate]");
  if (applyBtn) {
    const hotelId = applyBtn.dataset.applyHotelCandidate;
    const candidate = decodeURIComponent(applyBtn.dataset.candidateName || "");
    if (!candidate) return;
    updateHotelNameById(hotelId, candidate, { silent: true });
    state.hotels = state.hotels.map((item) =>
      item.id === hotelId ? { ...item, name: candidate, candidates: [] } : item,
    );
    renderHotelResults();
    renderSelectedHotel();
    setStatus(`候補名「${candidate}」で宿名を置き換えました。`);
  }
});

els.hotelResults.addEventListener("change", (e) => {
  const input = e.target.closest("input[data-hotel-name-input]");
  if (!input) return;
  updateHotelNameById(input.dataset.hotelNameInput, input.value);
});

function handleAddRoutePoint(targetDayIndex = state.activeDayIndex, insertAtIndex = null) {
  if (Number.isInteger(targetDayIndex) && targetDayIndex >= 0 && targetDayIndex < state.transportDays.length) {
    setActiveDay(targetDayIndex);
  }
  const plan = state.transportPlan;
  normalizeRoutePoints();
  const destinationIndex = plan.points.findIndex((p) => ensurePointObject(p).isDestination);
  const defaultInsertIndex = destinationIndex >= 0 ? destinationIndex : plan.points.length;
  const insertIndex =
    Number.isInteger(insertAtIndex) && insertAtIndex >= 0 && insertAtIndex <= plan.points.length
      ? insertAtIndex
      : defaultInsertIndex;
  plan.points.splice(insertIndex, 0, {
    name: "",
    url: "",
    candidates: [],
    isDestination: false,
    expanded: false,
  });
  renderRouteList();
  renderTransportDetail();
  setStatus("経由地入力欄を追加しました。最下段が目的地です。");
}

function parseDayAndIndex(value) {
  const [dayRaw, indexRaw] = String(value || "").split(":");
  const dayIndex = Number(dayRaw);
  const pointIndex = Number(indexRaw);
  return { dayIndex, pointIndex };
}

els.transportForm.addEventListener("submit", (e) => {
  e.preventDefault();
  handleAddRoutePoint();
});

function updateOriginByInputElement(inputEl) {
  const card = inputEl.closest(".card");
  const dayIndexRaw = card ? Number(card.dataset.dayCardIndex) : NaN;
  const dayIndex = Number.isInteger(dayIndexRaw) ? dayIndexRaw : state.activeDayIndex;
  if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex >= state.transportDays.length) return;
  state.transportDays[dayIndex].origin = inputEl.value.trim();
  if (dayIndex === state.activeDayIndex) {
    renderRouteList();
    renderTransportDetail();
  }
}

document.addEventListener("input", (e) => {
  const originInput = e.target.closest("input[list='origin-history']");
  if (!originInput) return;
  updateOriginByInputElement(originInput);
});

document.addEventListener("change", (e) => {
  const originInput = e.target.closest("input[list='origin-history']");
  if (!originInput) return;
  saveOriginHistory(originInput.value);
});

els.saveDefaultOriginBtn.addEventListener("click", () => {
  commitPendingSelectedHotelName();
  const ok = applyDefaultOriginFromInput(els.defaultOriginInput.value);
  if (!ok) return;
  setStatus(
    state.originInlineEditMode
      ? "デフォルト出発地をSELECTで保存しました。"
      : "デフォルト出発地を出発地へ反映しました。",
  );
});

els.useCurrentLocationBtn.addEventListener("click", () => {
  applyCurrentLocationToDay(state.activeDayIndex);
});

els.addRoutePoint.addEventListener("click", () => {
  const sourceCard = els.addRoutePoint.closest(".card");
  addDaySectionFromCard(sourceCard);
  renderRouteList();
  renderTransportDetail();
});
els.addRoutePoint.addEventListener("touchend", (e) => {
  e.preventDefault();
  const sourceCard = els.addRoutePoint.closest(".card");
  addDaySectionFromCard(sourceCard);
  renderRouteList();
  renderTransportDetail();
});

const deleteRouteDayBtn = document.getElementById("delete-route-day");
if (deleteRouteDayBtn) {
  deleteRouteDayBtn.addEventListener("click", () => {
    removeDaySectionByButton(deleteRouteDayBtn);
  });
}

document.addEventListener("click", (e) => {
  const dayFullRouteBtn = e.target.closest("button[data-open-day-full-route]");
  if (dayFullRouteBtn) {
    const card = dayFullRouteBtn.closest(".card");
    const dayIndex = Number(card?.dataset.dayCardIndex);
    if (Number.isInteger(dayIndex)) {
      setActiveDay(dayIndex);
    }
    const transport = getTransportModel();
    if (!transport) {
      setStatus("STARTとGOALを入力すると全体ルートを表示できます。", true);
      return;
    }
    openGoogleMap(transport.mapsUrl);
    return;
  }

  const dayFullRouteYahooBtn = e.target.closest("button[data-open-day-full-route-yahoo]");
  if (dayFullRouteYahooBtn) {
    const card = dayFullRouteYahooBtn.closest(".card");
    const dayIndex = Number(card?.dataset.dayCardIndex);
    if (Number.isInteger(dayIndex)) {
      setActiveDay(dayIndex);
    }
    const transport = getTransportModel();
    if (!transport) {
      setStatus("STARTとGOALを入力すると全体ルートを表示できます。", true);
      return;
    }
    openYahooCarNaviRoute(transport.origin, transport.destination);
    if (transport.waypoints.length) {
      setStatus("Yahooカーナビでは経由地を自動反映しないため、遷移先で経由地を追加してください。");
    }
    return;
  }

  const sectionToggleBtn = e.target.closest("button[data-section-toggle]");
  if (sectionToggleBtn) {
    const block = sectionToggleBtn.closest(".section-block");
    const body = block ? block.querySelector(".section-body") : null;
    if (!body) return;
    const nextOpen = body.classList.contains("hidden");
    body.classList.toggle("hidden", !nextOpen);
    sectionToggleBtn.textContent = nextOpen ? "▼" : "▶";
    return;
  }

  const dayExportBtn = e.target.closest(".day-export-btn");
  if (dayExportBtn) {
    exportSingleDay(dayExportBtn.closest(".card"));
    return;
  }

  const dayImportBtn = e.target.closest(".day-import-btn");
  if (dayImportBtn) {
    const card = dayImportBtn.closest(".card");
    const input = card ? card.querySelector(".day-import-file") : null;
    if (input) {
      input.value = "";
      input.click();
    }
    return;
  }

  const accordionBtn = e.target.closest(".day-accordion-toggle");
  if (accordionBtn) {
    const card = accordionBtn.closest(".card");
    if (!card) return;
    const nextOpen = !isDayCardOpen(card);
    setDayCardOpen(card, nextOpen);
    return;
  }

  const addBtn = e.target.closest(".day-card-add");
  if (addBtn && !addBtn.id) {
    addDaySectionFromCard(addBtn.closest(".card"));
    renderRouteList();
    renderTransportDetail();
    return;
  }
  const deleteBtn = e.target.closest(".day-card-delete");
  if (deleteBtn && !deleteBtn.id) {
    removeDaySectionByButton(deleteBtn);
  }
});

document.addEventListener("change", async (e) => {
  const dayImportInput = e.target.closest(".day-import-file");
  if (dayImportInput && dayImportInput.files && dayImportInput.files[0]) {
    try {
      const payload = await readJsonFile(dayImportInput.files[0]);
      importSingleDay(dayImportInput.closest(".card"), payload);
    } catch {
      setStatus("日ルートの読み込みに失敗しました。JSONファイルを確認してください。", true);
    } finally {
      dayImportInput.value = "";
    }
    return;
  }
});

if (els.hotelUrlHistoryBtn) {
  els.hotelUrlHistoryBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleTopHistoryDropdown("hotelUrl");
  });
}

els.originHistoryBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  toggleTopHistoryDropdown("origin");
});

if (els.destinationHistoryBtn) {
  els.destinationHistoryBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleTopHistoryDropdown("destination");
  });
}

if (els.hotelUrlHistoryEditBtn) {
  els.hotelUrlHistoryEditBtn.addEventListener("click", () => {
    openHistoryEditor("hotelUrl");
  });
}

els.originHistoryEditBtn.addEventListener("click", () => {
  const isHidden = els.originInlineEditor?.classList.contains("hidden");
  setOriginInlineEditorOpen(Boolean(isHidden));
});

if (els.destinationHistoryEditBtn) {
  els.destinationHistoryEditBtn.addEventListener("click", () => {
    openHistoryEditor("place");
  });
}

if (els.hotelUrlHistoryDropdown) {
  els.hotelUrlHistoryDropdown.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-use-top-history]");
    if (!btn) return;
    const value = decodeURIComponent(btn.dataset.historyValue || "");
    els.hotelUrlInput.value = value;
    closeTopHistoryDropdowns();
    setStatus("宿ページURLの履歴を適用しました。");
  });
}

els.originHistoryDropdown.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-use-top-history]");
  if (!btn) return;
  const value = decodeURIComponent(btn.dataset.historyValue || "");
  els.originInput.value = value;
  state.transportPlan.origin = value.trim();
  closeTopHistoryDropdowns();
  renderRouteList();
  renderTransportDetail();
  renderOriginInlineEditor();
  setStatus("出発地の履歴を適用しました。");
});

if (els.originInlineHistoryList) {
  const commitOriginInlineNameEdit = (target) => {
    const input = target.closest("input[data-origin-inline-source-index]");
    if (!input) return;
    renameOriginHistoryBySourceIndex(input.dataset.originInlineSourceIndex, input.value);
  };

  els.originInlineHistoryList.addEventListener("change", (e) => {
    commitOriginInlineNameEdit(e.target);
  });

  els.originInlineHistoryList.addEventListener("blur", (e) => {
    commitOriginInlineNameEdit(e.target);
  }, true);

  els.originInlineHistoryList.addEventListener("change", (e) => {
    const checkbox = e.target.closest("input[data-origin-inline-check-name]");
    if (!checkbox) return;
    const name = decodeURIComponent(checkbox.dataset.originInlineCheckName || "");
    if (!name) return;
    state.originInlineChecks[name] = checkbox.checked;
  });

  els.originInlineHistoryList.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-set-default-origin]");
    if (!btn) return;
    const name = decodeURIComponent(btn.dataset.setDefaultOrigin || "");
    if (!name) return;
    moveOriginHistoryEntryToDefault(name);
    setStatus("デフォルト出発地を更新しました。");
  });

  els.originInlineHistoryList.addEventListener("dragstart", (e) => {
    const row = e.target.closest(".origin-inline-item");
    if (!row || row.dataset.originIndex === "0") return;
    const idx = Number(row.dataset.originIndex);
    if (!Number.isInteger(idx) || idx <= 0) return;
    state.originInlineDragIndex = idx - 1;
    e.dataTransfer.effectAllowed = "move";
  });

  els.originInlineHistoryList.addEventListener("dragover", (e) => {
    if (!Number.isInteger(state.originInlineDragIndex)) return;
    e.preventDefault();
  });

  els.originInlineHistoryList.addEventListener("drop", (e) => {
    if (!Number.isInteger(state.originInlineDragIndex)) return;
    e.preventDefault();
    const row = e.target.closest(".origin-inline-item");
    const targetIdxRaw = row ? Number(row.dataset.originIndex) - 1 : -1;
    const fromIdx = state.originInlineDragIndex;
    state.originInlineDragIndex = null;
    if (!Number.isInteger(fromIdx) || fromIdx < 0 || fromIdx >= state.originHistory.length) return;
    if (targetIdxRaw < 0) {
      const [picked] = state.originHistory.splice(fromIdx, 1);
      moveOriginHistoryEntryToDefault(picked);
      setStatus("履歴をデフォルト出発地に設定しました。");
      return;
    }
    const toIdx = Math.max(0, Math.min(state.originHistory.length - 1, targetIdxRaw));
    if (fromIdx === toIdx) return;
    const [picked] = state.originHistory.splice(fromIdx, 1);
    state.originHistory.splice(toIdx, 0, picked);
    saveJson("ntt-origin-history", state.originHistory);
    renderOriginHistory();
    renderOriginInlineEditor();
  });

  els.originInlineHistoryList.addEventListener("dragend", () => {
    state.originInlineDragIndex = null;
  });
}

const originInlineDefaultRow = document.querySelector(".origin-inline-default-row");
if (originInlineDefaultRow) {
  originInlineDefaultRow.addEventListener("dragover", (e) => {
    if (!Number.isInteger(state.originInlineDragIndex)) return;
    e.preventDefault();
  });
  originInlineDefaultRow.addEventListener("drop", (e) => {
    if (!Number.isInteger(state.originInlineDragIndex)) return;
    e.preventDefault();
    const fromIdx = state.originInlineDragIndex;
    state.originInlineDragIndex = null;
    if (!Number.isInteger(fromIdx) || fromIdx < 0 || fromIdx >= state.originHistory.length) return;
    const [picked] = state.originHistory.splice(fromIdx, 1);
    moveOriginHistoryEntryToDefault(picked);
    setStatus("履歴をデフォルト出発地に設定しました。");
  });
}

const originDefaultCheckbox = document.querySelector("input[data-origin-inline-check='0']");
if (originDefaultCheckbox) {
  originDefaultCheckbox.addEventListener("change", () => {
    const key = (state.defaultOrigin || "").trim();
    if (!key) return;
    state.originInlineChecks[key] = originDefaultCheckbox.checked;
  });
}

if (els.originInlineSelectAll) {
  els.originInlineSelectAll.addEventListener("click", () => {
    const keys = [state.defaultOrigin, ...state.originHistory].map((name) => (name || "").trim()).filter(Boolean);
    state.originInlineChecks = Object.fromEntries(keys.map((name) => [name, true]));
    renderOriginInlineEditor();
  });
}

if (els.originInlineDeleteSelected) {
  els.originInlineDeleteSelected.addEventListener("click", () => {
    const selected = new Set(
      Object.entries(state.originInlineChecks)
        .filter(([, checked]) => checked)
        .map(([name]) => name),
    );
    if (!selected.size) {
      setStatus("削除する履歴をチェックしてください。", true);
      return;
    }
    const currentDefault = (state.defaultOrigin || "").trim();
    if (currentDefault && selected.has(currentDefault)) {
      const nextDefault = state.originHistory.find((name) => !selected.has(name)) || "";
      saveDefaultOrigin(nextDefault);
      if (els.originInput && currentDefault === (els.originInput.value || "").trim()) {
        els.originInput.value = nextDefault;
        if (Number.isInteger(state.activeDayIndex) && state.activeDayIndex >= 0 && state.activeDayIndex < state.transportDays.length) {
          state.transportDays[state.activeDayIndex].origin = nextDefault;
        }
      }
    }
    state.originHistory = state.originHistory.filter((name) => !selected.has(name));
    saveJson("ntt-origin-history", state.originHistory);
    state.originInlineChecks = {};
    renderOriginHistory();
    renderOriginInlineEditor();
    renderRouteList();
    renderTransportDetail();
    setStatus("チェックした出発地履歴を削除しました。");
  });
}

if (els.destinationHistoryDropdown) {
  els.destinationHistoryDropdown.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-use-top-history]");
    if (!btn) return;
    const value = decodeURIComponent(btn.dataset.historyValue || "");
    if (els.destinationInput) {
      els.destinationInput.value = value;
    }
    const hotel = ensureHotelInListFromHistoryName(value);
    if (hotel) {
      state.selectedHotel = hotel;
      syncDestinationWithHotel(hotel);
      renderHotelResults();
      renderSelectedHotel();
    } else {
      syncDestinationFromInput(value, { saveHistory: false });
    }
    closeTopHistoryDropdowns();
    setStatus("目的地の履歴を適用しました。");
  });
}

if (els.originUrlSuggestBtn) {
  els.originUrlSuggestBtn.addEventListener("click", () => {
    openMapAndShowUrlInput("origin");
  });
}

if (els.destinationUrlSuggestBtn) {
  els.destinationUrlSuggestBtn.addEventListener("click", () => {
    openMapAndShowUrlInput("destination");
  });
}

if (els.originMapUrlApply) {
  els.originMapUrlApply.addEventListener("click", () => {
    const sourceUrl = (els.originMapUrlInput && els.originMapUrlInput.value) || "";
    if (!sourceUrl.trim()) {
      setStatus("START用のGoogleMap URLを入力してください。", true);
      return;
    }
    suggestCandidatesFromPastedUrl("origin", sourceUrl);
  });
}

if (els.destinationMapUrlApply) {
  els.destinationMapUrlApply.addEventListener("click", () => {
    const sourceUrl = (els.destinationMapUrlInput && els.destinationMapUrlInput.value) || "";
    if (!sourceUrl.trim()) {
      setStatus("GOAL用のGoogleMap URLを入力してください。", true);
      return;
    }
    suggestCandidatesFromPastedUrl("destination", sourceUrl);
  });
}

if (els.originUrlCandidates) {
  els.originUrlCandidates.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-apply-origin-url-candidate]");
    if (!btn) return;
    const name = decodeURIComponent(btn.dataset.applyOriginUrlCandidate || "");
    if (!name) return;
    if (els.originInput) {
      els.originInput.value = name;
      updateOriginByInputElement(els.originInput);
      saveOriginHistory(name);
    }
    state.originUrlCandidates = [];
    renderOriginUrlCandidates();
    setStatus(`STARTを「${name}」に設定しました。`);
  });
}

if (els.destinationUrlCandidates) {
  els.destinationUrlCandidates.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-apply-destination-url-candidate]");
    if (!btn) return;
    const name = decodeURIComponent(btn.dataset.applyDestinationUrlCandidate || "");
    if (!name) return;
    if (els.destinationInput) {
      els.destinationInput.value = name;
    }
    syncDestinationFromInput(name);
    state.destinationUrlCandidates = [];
    renderDestinationUrlCandidates();
    setStatus(`GOALを「${name}」に設定しました。`);
  });
}

document.addEventListener("click", (e) => {
  const originHistoryBtn = e.target.closest("button[data-day-role='origin-history-btn']");
  if (originHistoryBtn && !originHistoryBtn.id) {
    e.stopPropagation();
    toggleDayHistoryDropdown(originHistoryBtn.closest(".card"), "origin");
    return;
  }

  const destinationHistoryBtn = e.target.closest("button[data-day-role='destination-history-btn']");
  if (destinationHistoryBtn && !destinationHistoryBtn.id) {
    e.stopPropagation();
    toggleDayHistoryDropdown(destinationHistoryBtn.closest(".card"), "destination");
    return;
  }

  const hotelUrlHistoryBtn = e.target.closest("button[data-day-role='hotel-url-history-btn']");
  if (hotelUrlHistoryBtn && !hotelUrlHistoryBtn.id) {
    e.stopPropagation();
    toggleDayHistoryDropdown(hotelUrlHistoryBtn.closest(".card"), "hotelUrl");
    return;
  }

  const historyUseBtn = e.target.closest("button[data-use-top-history]");
  if (!historyUseBtn) return;
  const dropdown = historyUseBtn.closest("[data-day-role='origin-history-dropdown'], [data-day-role='destination-history-dropdown'], [data-day-role='hotel-url-history-dropdown']");
  if (!dropdown || dropdown.id) return;

  const card = dropdown.closest(".card");
  const dayIndex = Number(card?.dataset.dayCardIndex);
  if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex >= state.transportDays.length) return;
  const target = historyUseBtn.dataset.useTopHistory;
  const value = decodeURIComponent(historyUseBtn.dataset.historyValue || "");

  if (target === "origin") {
    const originInput = card.querySelector("input[data-day-role='origin-input']");
    if (originInput) originInput.value = value;
    state.transportDays[dayIndex].origin = value.trim();
    closeAllDayHistoryDropdowns();
    if (dayIndex === state.activeDayIndex) {
      renderRouteList();
      renderTransportDetail();
    }
    setStatus("出発地の履歴を適用しました。");
    return;
  }

  if (target === "destination") {
    const destinationInput = card.querySelector("input[data-day-role='destination-input']");
    if (destinationInput) destinationInput.value = value;
    setActiveDay(dayIndex);
    const hotel = ensureHotelInListFromHistoryName(value);
    if (hotel) {
      state.selectedHotel = hotel;
      syncDestinationWithHotel(hotel);
      renderHotelResults();
      renderSelectedHotel();
    } else {
      syncDestinationFromInput(value, { saveHistory: false });
    }
    closeAllDayHistoryDropdowns();
    setStatus("目的地の履歴を適用しました。");
    return;
  }

  if (target === "hotelUrl") {
    const hotelUrlInput = card.querySelector("input[data-day-role='hotel-url-input']");
    if (hotelUrlInput) hotelUrlInput.value = value;
    closeAllDayHistoryDropdowns();
    setStatus("宿ページURLの履歴を適用しました。");
  }
});

document.addEventListener("click", (e) => {
  const target = e.target;
  if (
    target.closest("#hotel-url-history-btn") ||
    target.closest("#origin-history-btn") ||
    target.closest("#destination-history-btn") ||
    target.closest("#hotel-url-history-dropdown") ||
    target.closest("#origin-history-dropdown") ||
    target.closest("#destination-history-dropdown")
  ) {
    return;
  }
  closeTopHistoryDropdowns();
  closeAllDayHistoryDropdowns();
});

if (els.destinationInput) {
  els.destinationInput.addEventListener("change", () => {
    syncDestinationFromInput(els.destinationInput.value);
  });
}

if (els.exportAllDaysBtn) {
  els.exportAllDaysBtn.addEventListener("click", () => {
    exportAllDays();
  });
}

if (els.addWaypointBtn) {
  els.addWaypointBtn.addEventListener("click", () => {
    handleAddRoutePoint();
  });
}

if (els.importAllDaysBtn && els.importAllDaysFile) {
  els.importAllDaysBtn.addEventListener("click", () => {
    els.importAllDaysFile.value = "";
    els.importAllDaysFile.click();
  });
  els.importAllDaysFile.addEventListener("change", async () => {
    const file = els.importAllDaysFile.files && els.importAllDaysFile.files[0];
    if (!file) return;
    try {
      const payload = await readJsonFile(file);
      importAllDays(payload);
    } catch {
      setStatus("全日ルートの読み込みに失敗しました。JSONファイルを確認してください。", true);
    } finally {
      els.importAllDaysFile.value = "";
    }
  });
}

if (els.exportChoiceClose) {
  els.exportChoiceClose.addEventListener("click", () => {
    closeExportChoiceModal();
  });
}

if (els.exportChoiceModal) {
  els.exportChoiceModal.addEventListener("click", (e) => {
    if (e.target === els.exportChoiceModal) {
      closeExportChoiceModal();
    }
  });
}

if (els.exportChoiceDownload) {
  els.exportChoiceDownload.addEventListener("click", () => {
    if (!state.pendingExport) return;
    downloadJson(state.pendingExport.filename, state.pendingExport.payload);
    closeExportChoiceModal();
    setStatus("ダウンロードしました。");
  });
}

if (els.exportChoiceAirdrop) {
  els.exportChoiceAirdrop.addEventListener("click", async () => {
    if (!state.pendingExport) return;
    try {
      await shareJsonViaNative(state.pendingExport.filename, state.pendingExport.payload);
      setStatus("共有シートを開きました（AirDropを選択できます）。");
    } catch {
      setStatus("この端末ではAirDrop共有を開けません。ダウンロードかLINEを使ってください。", true);
      return;
    }
    closeExportChoiceModal();
  });
}

if (els.exportChoiceLine) {
  els.exportChoiceLine.addEventListener("click", async () => {
    if (!state.pendingExport) return;
    const mode = await shareJsonToLine(state.pendingExport.filename, state.pendingExport.payload);
    closeExportChoiceModal();
    setStatus(mode === "shared" ? "LINE共有を開きました。" : "LINE送信用画面を開きました。");
  });
}

els.routeList.addEventListener("click", (e) => {
  const disabledSegmentBtn = e.target.closest("button[data-open-segment-disabled], button[data-open-segment-yahoo-disabled]");
  if (disabledSegmentBtn) {
    const reason = disabledSegmentBtn.dataset.segmentReason || "区間ルートを生成できません。";
    setStatus(reason, true);
    return;
  }

  const addWaypointAtBtn = e.target.closest("button[data-add-waypoint-at]");
  if (addWaypointAtBtn) {
    const { dayIndex, pointIndex } = parseDayAndIndex(addWaypointAtBtn.dataset.addWaypointAt);
    handleAddRoutePoint(dayIndex, pointIndex);
    return;
  }

  const togglePointBtn = e.target.closest("button[data-toggle-point]");
  if (togglePointBtn) {
    const { dayIndex, pointIndex } = parseDayAndIndex(togglePointBtn.dataset.togglePoint);
    setActiveDay(dayIndex);
    if (!Number.isInteger(pointIndex) || pointIndex < 0 || pointIndex >= state.transportPlan.points.length) return;
    const current = ensurePointObject(state.transportPlan.points[pointIndex]);
    state.transportPlan.points[pointIndex] = { ...current, expanded: !current.expanded };
    renderRouteList();
    return;
  }

  const toggleDayBtn = e.target.closest("button[data-toggle-day]");
  if (toggleDayBtn) {
    const dayIndex = Number(toggleDayBtn.dataset.toggleDay);
    const day = state.transportDays[dayIndex];
    if (!day) return;
    day.expanded = !day.expanded;
    if (day.expanded) {
      setActiveDay(dayIndex);
    }
    renderRouteList();
    renderTransportDetail();
    return;
  }

  const openPointUrlBtn = e.target.closest("button[data-open-point-url]");
  if (openPointUrlBtn) {
    const { dayIndex, pointIndex } = parseDayAndIndex(openPointUrlBtn.dataset.openPointUrl);
    setActiveDay(dayIndex);
    const point = ensurePointObject(state.transportPlan.points[pointIndex]);
    if (!point.url) {
      setStatus("サイトURLが設定されていません。", true);
      return;
    }
    window.open(point.url, "_blank", "noopener,noreferrer");
    return;
  }

  const closeCandidatesBtn = e.target.closest("button[data-close-candidates]");
  if (closeCandidatesBtn) {
    const { dayIndex, pointIndex } = parseDayAndIndex(closeCandidatesBtn.dataset.closeCandidates);
    setActiveDay(dayIndex);
    const current = ensurePointObject(state.transportPlan.points[pointIndex]);
    state.transportPlan.points[pointIndex] = { ...current, candidates: [] };
    renderRouteList();
    renderTransportDetail();
    setStatus("Google検索候補を閉じました。");
    return;
  }

  const openHistoryBtn = e.target.closest("button[data-open-history]");
  if (openHistoryBtn) {
    const key = openHistoryBtn.dataset.openHistory;
    state.activeHistoryDropdownIndex = state.activeHistoryDropdownIndex === key ? null : key;
    renderRouteList();
    return;
  }

  const editHistoryBtn = e.target.closest("button[data-edit-history]");
  if (editHistoryBtn) {
    openHistoryEditor("place");
    return;
  }

  const useHistoryBtn = e.target.closest("button[data-use-history]");
  if (useHistoryBtn) {
    const { dayIndex, pointIndex } = parseDayAndIndex(useHistoryBtn.dataset.useHistory);
    setActiveDay(dayIndex);
    const historyName = decodeURIComponent(useHistoryBtn.dataset.historyName || "");
    const current = ensurePointObject(state.transportPlan.points[pointIndex]);
    state.transportPlan.points[pointIndex] = { ...current, name: historyName };
    state.activeHistoryDropdownIndex = null;
    renderRouteList();
    renderTransportDetail();
    setStatus(`履歴「${historyName}」を適用しました。`);
    return;
  }

  const segmentBtn = e.target.closest("button[data-open-segment], button[data-open-segment-from]");
  if (segmentBtn) {
    const from = decodeURIComponent(segmentBtn.dataset.openSegmentFrom || "");
    const to = decodeURIComponent(segmentBtn.dataset.openSegmentTo || "");
    if (!from || !to) {
      const { dayIndex, pointIndex } = parseDayAndIndex(segmentBtn.dataset.openSegment);
      const segment = buildRouteSegments(state.transportDays[dayIndex]).find((item) => item.index === pointIndex);
      if (!segment) {
        setStatus("区間ルートを生成できませんでした。", true);
        return;
      }
      renderSegmentDetail(segment);
      openGoogleMap(segment.mapsUrl);
      setStatus(`区間「${segment.from} → ${segment.to}」のGoogleMapを表示しました。`);
      return;
    }
    const mapsUrl = `https://www.google.com/maps/dir/${encodeURIComponent(from)}/${encodeURIComponent(to)}`;
    renderSegmentDetail({ from, to, mapsUrl });
    openGoogleMap(mapsUrl);
    setStatus(`区間「${from} → ${to}」のGoogleMapを表示しました。`);
    return;
  }

  const segmentYahooBtn = e.target.closest("button[data-open-segment-yahoo], button[data-open-segment-yahoo-from]");
  if (segmentYahooBtn) {
    const from = decodeURIComponent(segmentYahooBtn.dataset.openSegmentYahooFrom || "");
    const to = decodeURIComponent(segmentYahooBtn.dataset.openSegmentYahooTo || "");
    if (!from || !to) {
      const { dayIndex, pointIndex } = parseDayAndIndex(segmentYahooBtn.dataset.openSegmentYahoo);
      const segment = buildRouteSegments(state.transportDays[dayIndex]).find((item) => item.index === pointIndex);
      if (!segment) {
        setStatus("区間ルートを生成できませんでした。", true);
        return;
      }
      openYahooCarNaviRoute(segment.from, segment.to);
      setStatus(`区間「${segment.from} → ${segment.to}」をYahooカーナビで表示します。`);
      return;
    }
    openYahooCarNaviRoute(from, to);
    setStatus(`区間「${from} → ${to}」をYahooカーナビで表示します。`);
    return;
  }

  const suggestBtn = e.target.closest("button[data-google-suggest]");
  if (suggestBtn) {
    const { dayIndex, pointIndex } = parseDayAndIndex(suggestBtn.dataset.googleSuggest);
    setActiveDay(dayIndex);
    const current = ensurePointObject(state.transportPlan.points[pointIndex]);
    if (Array.isArray(current.candidates) && current.candidates.length) {
      state.transportPlan.points[pointIndex] = { ...current, candidates: [] };
      renderRouteList();
      renderTransportDetail();
      setStatus("名称候補を閉じました。");
      return;
    }
    const query = current.name.trim();
    if (!query) {
      setStatus("Google検索候補を取るには、先に地名や施設名を入力してください。", true);
      return;
    }

    setStatus("Google検索候補を取得中です...");
    fetchGoogleSuggestions(query)
      .then((candidates) => {
        state.transportPlan.points[pointIndex] = { ...current, candidates };
        renderRouteList();
        renderTransportDetail();
        setStatus(
          candidates.length
            ? "Google検索候補を取得しました。候補を押すと名称を置換できます。"
            : "Google検索候補が見つかりませんでした。",
          !candidates.length,
        );
      })
      .catch(() => {
        setStatus("Google検索候補の取得に失敗しました。時間を置いて再試行してください。", true);
      });
    return;
  }

  const urlSuggestBtn = e.target.closest("button[data-url-suggest]");
  if (urlSuggestBtn) {
    const { dayIndex, pointIndex } = parseDayAndIndex(urlSuggestBtn.dataset.urlSuggest);
    setActiveDay(dayIndex);
    const current = ensurePointObject(state.transportPlan.points[pointIndex]);
    const sourceUrl = (current.url || "").trim();
    const urlInput = els.routeList.querySelector(`input[data-point-url="${dayIndex}:${pointIndex}"]`);
    if (urlInput) {
      urlInput.focus();
    }
    openMapPicker("https://www.google.com/maps");
    if (!sourceUrl) {
      setStatus("GoogleMapのURLをこの経由地のURL欄に貼り付けて、もう一度「MAPから」を押してください。", true);
      return;
    }
    const candidates = extractNameCandidatesFromUrl(sourceUrl);
    if (!candidates.length) {
      setStatus("URLから候補を抽出できませんでした。", true);
      return;
    }
    state.transportPlan.points[pointIndex] = { ...current, url: sourceUrl, candidates };
    renderRouteList();
    renderTransportDetail();
    setStatus("URLから名称候補を取得しました。");
    return;
  }

  const applyBtn = e.target.closest("button[data-apply-candidate]");
  if (applyBtn) {
    const { dayIndex, pointIndex } = parseDayAndIndex(applyBtn.dataset.applyCandidate);
    setActiveDay(dayIndex);
    const name = decodeURIComponent(applyBtn.dataset.candidateName || "");
    const current = ensurePointObject(state.transportPlan.points[pointIndex]);
    const prevName = current.name;
    state.transportPlan.points[pointIndex] = { ...current, name };
    replacePlaceHistoryName(prevName, name);
    savePlaceHistory(name);
    renderRouteList();
    renderTransportDetail();
    setStatus(`候補名「${name}」で置き換えました。`);
    return;
  }

  const googleBtn = e.target.closest("button[data-google-search]");
  if (googleBtn) {
    const { dayIndex, pointIndex } = parseDayAndIndex(googleBtn.dataset.googleSearch);
    setActiveDay(dayIndex);
    const point = ensurePointObject(state.transportPlan.points[pointIndex]);
    const query = point.name.trim();
    if (!query) {
      setStatus("検索する地名を入力してください。", true);
      return;
    }
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    window.open(searchUrl, "_blank", "noopener,noreferrer");
    return;
  }

  const removeBtn = e.target.closest("button[data-remove-point]");
  if (removeBtn) {
    const { dayIndex, pointIndex } = parseDayAndIndex(removeBtn.dataset.removePoint);
    setActiveDay(dayIndex);
    state.transportPlan.points.splice(pointIndex, 1);
    normalizeRoutePoints();
    renderRouteList();
    renderTransportDetail();
    setStatus("ルート地点を削除しました。");
    return;
  }

  const moveToDayBtn = e.target.closest("button[data-move-to-day]");
  if (moveToDayBtn) {
    const { dayIndex, pointIndex } = parseDayAndIndex(moveToDayBtn.dataset.moveToDay);
    const row = moveToDayBtn.closest(".route-item");
    const select = row
      ? row.querySelector(`select[data-move-day-select="${dayIndex}:${pointIndex}"]`) ||
        row.querySelector("select[data-move-day-select]")
      : null;
    const toDay = select ? Number(select.value) : dayIndex;
    if (!Number.isInteger(toDay) || toDay < 0 || toDay >= state.transportDays.length) {
      setStatus("移動先の日付が不正です。", true);
      return;
    }
    if (toDay === dayIndex) {
      setStatus("同じ日が選択されています。", true);
      return;
    }
    const moved = movePointToAnotherDay(dayIndex, pointIndex, toDay);
    if (!moved) {
      setStatus("別日への移動に失敗しました。", true);
      return;
    }
    setActiveDay(dayIndex);
    renderRouteList();
    renderHotelResults();
    renderRouteListIntoDayCard(toDay);
    renderTransportDetail();
    setStatus(`DAY${dayIndex + 1}からDAY${toDay + 1}へ移動しました。`);
    return;
  }

  const upBtn = e.target.closest("button[data-move-up]");
  if (upBtn) {
    const { dayIndex, pointIndex } = parseDayAndIndex(upBtn.dataset.moveUp);
    setActiveDay(dayIndex);
    moveRoutePoint(pointIndex, Math.max(0, pointIndex - 1));
    renderRouteList();
    renderTransportDetail();
    setStatus("ルート順を変更しました。");
    return;
  }

  const downBtn = e.target.closest("button[data-move-down]");
  if (downBtn) {
    const { dayIndex, pointIndex } = parseDayAndIndex(downBtn.dataset.moveDown);
    setActiveDay(dayIndex);
    moveRoutePoint(pointIndex, Math.min(state.transportPlan.points.length - 1, pointIndex + 1));
    renderRouteList();
    renderTransportDetail();
    setStatus("ルート順を変更しました。");
  }
});

if (els.transportDetail) {
  els.transportDetail.addEventListener("click", (e) => {
    const fullRouteBtn = e.target.closest("button[data-open-full-route]");
    const fullRouteYahooBtn = e.target.closest("button[data-open-full-route-yahoo]");
    if (!fullRouteBtn && !fullRouteYahooBtn) return;

    const transport = getTransportModel();
    if (!transport) {
      setStatus("出発地と目的地を入力すると全体ルートを表示できます。", true);
      return;
    }

    if (fullRouteBtn) {
      openGoogleMap(transport.mapsUrl);
      return;
    }

    openYahooCarNaviRoute(transport.origin, transport.destination);
    if (transport.waypoints.length) {
      setStatus("Yahooカーナビでは経由地を自動反映しないため、遷移先で経由地を追加してください。");
    }
  });
}

els.routeList.addEventListener("input", (e) => {
  const nameInput = e.target.closest("input[data-point-input]");
  if (nameInput) {
    const { dayIndex, pointIndex } = parseDayAndIndex(nameInput.dataset.pointInput);
    setActiveDay(dayIndex);
    if (!Number.isInteger(pointIndex) || pointIndex < 0 || pointIndex >= state.transportPlan.points.length) return;
    const current = ensurePointObject(state.transportPlan.points[pointIndex]);
    state.transportPlan.points[pointIndex] = { ...current, name: nameInput.value };
    normalizeRoutePoints();
    renderTransportDetail();
    return;
  }

  const urlInput = e.target.closest("input[data-point-url]");
  if (!urlInput) return;
  const { dayIndex, pointIndex } = parseDayAndIndex(urlInput.dataset.pointUrl);
  setActiveDay(dayIndex);
  if (!Number.isInteger(pointIndex) || pointIndex < 0 || pointIndex >= state.transportPlan.points.length) return;
  const current = ensurePointObject(state.transportPlan.points[pointIndex]);
  state.transportPlan.points[pointIndex] = { ...current, url: urlInput.value, candidates: [] };
  normalizeRoutePoints();
  renderTransportDetail();
});

els.routeList.addEventListener("change", (e) => {
  const segmentTimeSelect = e.target.closest("select[data-segment-time-select]");
  if (segmentTimeSelect) {
    const { dayIndex, pointIndex } = parseDayAndIndex(segmentTimeSelect.dataset.segmentTimeSelect);
    setSegmentManualTime(dayIndex, pointIndex, segmentTimeSelect.value);
    saveTransportState();
    setStatus(segmentTimeSelect.value ? "区間の手動時間を保存しました。" : "区間の手動時間をクリアしました。");
    return;
  }

  const nameInput = e.target.closest("input[data-point-input]");
  if (!nameInput) return;
  savePlaceHistory(nameInput.value);
});

els.routeList.addEventListener("dragstart", (e) => {
  const dayCard = e.target.closest("[data-day-card]");
  if (dayCard && e.target.closest(".route-day-head")) {
    state.draggedDayIndex = Number(dayCard.dataset.dayCard);
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", `day:${state.draggedDayIndex}`);
    }
    return;
  }

  const item = e.target.closest("li[data-day-index][data-index]");
  if (!item) return;
  state.draggedPointIndex = { dayIndex: Number(item.dataset.dayIndex), pointIndex: Number(item.dataset.index) };
  item.classList.add("dragging");
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", `${item.dataset.dayIndex}:${item.dataset.index}`);
  }
});

els.routeList.addEventListener("dragend", (e) => {
  const item = e.target.closest("li[data-day-index][data-index]");
  if (item) item.classList.remove("dragging");
  state.draggedDayIndex = null;
});

els.routeList.addEventListener("dragover", (e) => {
  const target = e.target.closest("li[data-day-index][data-index], [data-day-card], [data-day-dropzone]");
  if (!target) return;
  e.preventDefault();
});

els.routeList.addEventListener("drop", (e) => {
  const dayCard = e.target.closest("[data-day-card]");
  if (dayCard && Number.isInteger(state.draggedDayIndex)) {
    e.preventDefault();
    const toDay = Number(dayCard.dataset.dayCard);
    const fromDay = state.draggedDayIndex;
    state.draggedDayIndex = null;
    if (fromDay !== toDay && fromDay >= 0 && toDay >= 0) {
      const moved = state.transportDays.splice(fromDay, 1)[0];
      state.transportDays.splice(toDay, 0, moved);
      setActiveDay(toDay);
      renderRouteList();
      renderTransportDetail();
    }
    return;
  }

  const target = e.target.closest("li[data-day-index][data-index], [data-day-dropzone]");
  if (!target) return;
  e.preventDefault();

  if (!state.draggedPointIndex || typeof state.draggedPointIndex !== "object") return;
  const fromDay = state.draggedPointIndex.dayIndex;
  const fromIndex = state.draggedPointIndex.pointIndex;
  let toDay = Number(target.dataset.dayIndex ?? target.dataset.dayDropzone);
  let toIndex = Number(target.dataset.index);
  if (!Number.isInteger(toIndex)) {
    const toPlan = state.transportDays[toDay];
    if (!toPlan) return;
    const destIdx = toPlan.points.findIndex((p) => ensurePointObject(p).isDestination);
    toIndex = destIdx >= 0 ? destIdx : toPlan.points.length;
  }
  state.draggedPointIndex = null;
  if (!Number.isInteger(fromIndex) || !Number.isInteger(fromDay) || !Number.isInteger(toDay)) return;

  if (fromDay === toDay) {
    setActiveDay(fromDay);
    moveRoutePoint(fromIndex, toIndex);
  } else {
    const fromPlan = state.transportDays[fromDay];
    const toPlan = state.transportDays[toDay];
    if (!fromPlan || !toPlan) return;
    const moving = ensurePointObject(fromPlan.points[fromIndex]);
    fromPlan.points.splice(fromIndex, 1);
    toPlan.points.push({ ...moving, isDestination: false });
    normalizePlanPoints(fromPlan);
    normalizePlanPoints(toPlan);
  }
  renderRouteList();
  renderTransportDetail();
  setStatus("ドラッグでルートを更新しました。");
});

els.historyEditorClose.addEventListener("click", closeHistoryEditor);

els.historyEditorModal.addEventListener("click", (e) => {
  if (e.target === els.historyEditorModal) {
    closeHistoryEditor();
  }
});

els.historyEditorList.addEventListener("change", (e) => {
  const checkbox = e.target.closest("input[data-history-check]");
  if (!checkbox) return;
  const key = decodeURIComponent(checkbox.dataset.historyCheck || "");
  state.historyEditorChecks[key] = checkbox.checked;
});

els.historySelectAll.addEventListener("click", () => {
  const list = getHistoryByTarget(state.historyEditorTarget);
  state.historyEditorChecks = Object.fromEntries(
    list.map((item) => [state.historyEditorTarget === "hotelUrl" ? item.url : item, true]),
  );
  renderHistoryEditorList();
});

els.historyDeleteSelected.addEventListener("click", () => {
  const targets = new Set(
    Object.entries(state.historyEditorChecks)
      .filter(([, checked]) => checked)
      .map(([name]) => name),
  );
  if (!targets.size) {
    setStatus("削除する履歴をチェックしてください。", true);
    return;
  }

  const currentList = getHistoryByTarget(state.historyEditorTarget);
  setHistoryByTarget(
    state.historyEditorTarget,
    currentList.filter((item) => !targets.has(state.historyEditorTarget === "hotelUrl" ? item.url : item)),
  );
  state.historyEditorChecks = {};
  renderHistoryEditorList();
  renderRouteList();
  setStatus("チェックした履歴を削除しました。");
});

if (els.spotForm) {
  els.spotForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const item = {
      type: document.getElementById("spotType").value,
      name: document.getElementById("spotName").value.trim(),
      map: document.getElementById("spotMap").value.trim(),
      memo: document.getElementById("spotMemo").value.trim(),
      url: document.getElementById("spotUrl").value.trim(),
      cost: Number(document.getElementById("spotCost").value || 0),
    };
    state.spots.push(item);
    renderSpots();
    els.spotForm.reset();
    document.getElementById("spotCost").value = "0";
    setStatus(`「${item.name}」をリストに追加しました。`);
  });
}

if (els.buildBtn) {
  els.buildBtn.addEventListener("click", () => {
  const transport = getTransportModel();

  if (!state.selectedHotel || !transport || !state.spots.length) {
    setStatus("宿1件・車ルート（出発地/目的地）・スポット/食事1件以上をそろえてください。", true);
    return;
  }

  const spotTotal = state.spots.reduce((acc, s) => acc + s.cost, 0);
  const hotelTotal = state.selectedHotel.total;
  const total = hotelTotal + transport.price + spotTotal;
  saveOriginHistory(transport.origin);

  const itinerary = {
    createdAt: new Date().toLocaleString("ja-JP"),
    origin: transport.origin,
    destination: transport.destination,
    hotel: state.selectedHotel,
    transport,
    spots: state.spots,
    total,
    mapsUrl: transport.mapsUrl,
  };

  state.history.unshift(itinerary);
  saveJson("ntt-history", state.history);

  els.itineraryOutput.classList.remove("muted");
  els.itineraryOutput.innerHTML = `
    <strong>旅のしおり</strong><br />
    ルート: ${transport.origin} → ${transport.destination}<br />
    宿: ${itinerary.hotel.name} (${itinerary.hotel.site})<br />
    交通: ${transport.category} ${transport.name}<br />
    経由地数: ${transport.waypoints.length}<br />
    <a href="${itinerary.mapsUrl}" target="_blank" rel="noopener noreferrer">Google Mapsでルート確認</a><br />
    <strong>トータル金額: ¥${total.toLocaleString()}</strong>
  `;

  renderHistory();
  setStatus("旅のしおりを作成して履歴に保存しました。");
  });
}

if (els.clearAll) {
  els.clearAll.addEventListener("click", () => {
  state.hotels = [];
  state.selectedHotel = null;
  state.transportDays = [{ origin: "", points: [], expanded: true, segmentTimes: {} }];
  state.activeDayIndex = 0;
  state.draggedPointIndex = null;
  state.draggedDayIndex = null;
  state.spots = [];
  state.history = [];

  localStorage.removeItem("ntt-history");
  localStorage.removeItem("ntt-transport-days");
  localStorage.removeItem("ntt-active-day-index");

  els.transportForm.reset();

  renderHotelResults();
  renderSelectedHotel();
  renderRouteList();
  renderTransportDetail();
  renderSpots();
  renderHistory();
  els.itineraryOutput.textContent = "必要項目を入力後に作成できます。";
  els.itineraryOutput.classList.add("muted");
  setStatus("全データをクリアしました。");
  });
}

function init() {
  normalizeStoredHistories();
  if (els.defaultOriginInput) {
    els.defaultOriginInput.value = state.defaultOrigin;
  }
  if (state.defaultOrigin && state.transportDays[0] && !state.transportDays[0].origin) {
    state.transportDays[0].origin = state.defaultOrigin;
    if (!els.originInput.value) {
      els.originInput.value = state.defaultOrigin;
    }
  }
  if (els.destinationInput) {
    const destinationPoint = (state.transportPlan.points || [])
      .map(ensurePointObject)
      .find((point) => point.isDestination);
    if (destinationPoint && destinationPoint.name) {
      els.destinationInput.value = destinationPoint.name;
    }
  }
  if (!Number.isInteger(state.activeDayIndex) || state.activeDayIndex < 0 || state.activeDayIndex >= state.transportDays.length) {
    state.activeDayIndex = 0;
  }
  renderHotelResults();
  renderSelectedHotel();
  renderOriginHistory();
  setOriginInlineEditMode(false);
  renderOriginInlineEditor();
  setActiveDay(state.activeDayIndex);
  renderRouteList();
  renderTransportDetail();
  renderSpots();
  renderHistory();
  renumberDaySectionTitles();
  setupDayAccordionDefaults();
  setStatus("");
}

init();
