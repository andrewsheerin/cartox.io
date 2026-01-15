/* =========================================================
   GLOBAL STATE
========================================================= */

let map;
let extentMap;
let extentRect;
let gameStarted = false;

let countryData = {};             // alias canonical -> feature
let countriesByCanonical = {};    // canonical (true name) -> feature
let countryLayers = {};           // canonical -> { layer, label }
let revealedCountries = new Set();
let finalGuessedCount = null;

let totalCountries = 0;
let input;
let dataLoaded = false;

let timerInterval = null;
let secondsElapsed = 0;

/* =========================================================
   CONTINENT LIST VIEW STATE
========================================================= */

// "grid" = extent map + 6 continent tiles
// "list" = country list + 6 continent tiles
let continentPanelMode = "grid";

// Active continent when in list mode
let activeContinent = null;

// For each continent: sorted array of { name, canonical }
let continentCountryIndex = {};

// canonical -> { continent, index }
let canonicalToContinentInfo = {};

/* =========================================================
   AUTOCOMPLETE STATE
========================================================= */

let autocompleteEl = null;
let allCountriesList = []; // [{ name, canonical }] sorted by display name
let activeSuggestionIndex = -1;

/* =========================================================
   CONTINENTS
========================================================= */

const CONTINENTS = [
  "North America",
  "South America",
  "Asia",
  "Europe",
  "Africa",
  "Oceania"
];

const CONTINENT_ID = {
  "North America": "na",
  "South America": "sa",
  "Asia": "as",
  "Europe": "eu",
  "Africa": "af",
  "Oceania": "oc"
};

let continentTotals = {};
let continentGuessed = {};

const NARROW_BREAKPOINT = 700;

/* =========================================================
   HELPERS
========================================================= */

function isNarrowScreen() {
  return window.innerWidth <= NARROW_BREAKPOINT;
}

function isEndgameActive() {
  return !document
    .getElementById("endgame-overlay")
    .classList.contains("hidden");
}

function formatTime(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function normalizeName(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function createCountryLayer(feature, color) {
  return L.geoJSON(feature, {
    style: { color, fillColor: color, weight: 2, fillOpacity: 0.45 },
    noWrap: true
  });
}

function getLabelFontSize(feature, zoom) {
  const min = feature.properties.label_min ?? 10;
  const max = feature.properties.label_max ?? 22;
  const t = Math.min(Math.max((zoom - 3) / 4, 0), 1);
  return min + (max - min) * t;
}

function updateProgress() {
  document.getElementById("progress-tracker").textContent =
    `${revealedCountries.size} / ${totalCountries}`;
}

function updateContinentBox(continent) {
  const id = CONTINENT_ID[continent];
  const el = document.getElementById(`${id}-progress`);
  if (!el) return;
  el.textContent = `${continentGuessed[continent] || 0} / ${continentTotals[continent] || 0}`;
}

function updateAllContinentBoxes() {
  CONTINENTS.forEach(updateContinentBox);
}

function continentOfFeature(feature) {
  return feature?.properties?.continent || "Unknown";
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildAllCountriesList() {
  const arr = Object.entries(countriesByCanonical).map(([canonical, feature]) => ({
    canonical,
    name: feature.properties.country_name
  }));
  arr.sort((a, b) => a.name.localeCompare(b.name));
  return arr;
}

/* =========================================================
   AUTOCOMPLETE HELPERS
========================================================= */

function hideAutocomplete() {
  if (!autocompleteEl) return;
  autocompleteEl.classList.add("hidden");
  autocompleteEl.innerHTML = "";
  activeSuggestionIndex = -1;
}

function showAutocomplete(items) {
  if (!autocompleteEl) return;

  if (!items.length) {
    hideAutocomplete();
    return;
  }

  autocompleteEl.innerHTML = items
    .map((item, idx) => {
      const guessed = revealedCountries.has(item.canonical) ? " guessed" : "";
      return `<div class="autocomplete-item${guessed}" data-idx="${idx}" data-canonical="${item.canonical}">${escapeHtml(item.name)}</div>`;
    })
    .join("");

  autocompleteEl.classList.remove("hidden");
  activeSuggestionIndex = -1;
}

function getSuggestions(prefix, limit = 20) {
  const p = normalizeName(prefix);
  if (!p) return [];

  const out = [];
  for (const item of allCountriesList) {
    if (item.canonical.startsWith(p)) out.push(item);
    if (out.length >= limit) break;
  }
  return out;
}

/* =========================================================
   EXTENT MAP SYNC
========================================================= */

function updateExtentRectangle() {
  if (!extentRect) return;
  extentRect.setBounds(map.getBounds());
}

function refreshExtentMap() {
  if (!extentMap) return;
  extentMap.invalidateSize();
  extentMap.fitWorld({ animate: false });
  updateExtentRectangle();
}

/* =========================================================
   CONTINENT PANEL VIEW
========================================================= */

function setContinentPanelMode(mode) {
  continentPanelMode = mode;

  const listView = document.getElementById("continent-list-view");
  const extentContainer = document.getElementById("extent-map-container");

  if (mode === "grid") {
    listView.classList.add("hidden");

    // Rule: no extent map ever on narrow screens
    if (isNarrowScreen() && gameStarted) {
      extentContainer.classList.add("hidden");
    } else {
      extentContainer.classList.remove("hidden");
    }

    activeContinent = null;
    refreshContinentGridTiles();
    return;
  }

  // list mode
  extentContainer.classList.add("hidden");
  listView.classList.remove("hidden");
  refreshContinentGridTiles();
}

function refreshContinentGridTiles() {
  // Reserved for future UI state; keep harmless.
  document.querySelectorAll(".continent-card").forEach(btn => {
    const cont = btn.dataset.continent;
    void cont;
  });
}

function renderContinentCountryList(continent) {
  const title = document.getElementById("continent-list-title");
  const list = document.getElementById("continent-country-list");

  title.textContent = continent;

  const items = continentCountryIndex[continent] || [];
  list.innerHTML = "";

  items.forEach(item => {
    const row = document.createElement("div");
    row.className = "country-row";
    row.dataset.canonical = item.canonical;

    // Keep spacing stable: always set text to real name.
    row.textContent = item.name;

    if (revealedCountries.has(item.canonical)) {
      row.classList.add("guessed");
    } else {
      row.classList.add("placeholder");
    }

    list.appendChild(row);
  });
}

function updateActiveContinentListRow(canonical) {
  if (continentPanelMode !== "list" || !activeContinent) return;
  const info = canonicalToContinentInfo[canonical];
  if (!info || info.continent !== activeContinent) return;

  const row = document.querySelector(
    `#continent-country-list .country-row[data-canonical="${canonical}"]`
  );
  if (!row) return;

  row.classList.remove("placeholder");
  row.classList.add("guessed");
}

function enforceNarrowDefaults() {
  const panel = document.getElementById("continent-panel");
  const toggleBtn = document.getElementById("toggle-continent-panel");
  const extent = document.getElementById("extent-map-container");

  if (!panel || !toggleBtn || !extent) return;

  if (isNarrowScreen() && gameStarted) {
    // Rule: always default to hidden on narrow.
    panel.classList.add("hidden");
    toggleBtn.classList.remove("hidden");
    toggleBtn.textContent = "Show Continent Panel";
    extent.classList.add("hidden"); // never show extent on narrow
  } else {
    toggleBtn.classList.add("hidden");
    panel.classList.add("hidden");
    extent.classList.add("hidden");
  }
}

/* =========================================================
   GAME ACTIONS
========================================================= */

function revealCountryByFeature(feature) {
  if (!feature) return;

  const canonical = normalizeName(feature.properties.country_name);
  if (!canonical) return;
  if (revealedCountries.has(canonical)) return;

  // Draw layer + label
  const layer = createCountryLayer(feature, "#1E90FF").addTo(map);

  const center =
    Number.isFinite(feature.properties.label_x)
      ? [feature.properties.label_y, feature.properties.label_x]
      : layer.getBounds().getCenter();

  const label = L.marker(center, {
    icon: L.divIcon({
      className: "country-label",
      html: feature.properties.country_name
    })
  }).addTo(map);

  const el = label.getElement();
  if (el) el.style.fontSize = `${getLabelFontSize(feature, map.getZoom())}px`;

  countryLayers[canonical] = { layer, label };
  revealedCountries.add(canonical);

  const cont = continentOfFeature(feature);
  continentGuessed[cont] = (continentGuessed[cont] || 0) + 1;
  updateContinentBox(cont);
  updateProgress();
  updateActiveContinentListRow(canonical);

  // Slow zoom (your requested change)
  map.fitBounds(layer.getBounds(), {
    padding: [20, 20],
    maxZoom: 5,
    animate: true,
    duration: 1.5
  });

  if (revealedCountries.size === totalCountries) {
    setTimeout(endGame, 800);
  }
}

/* =========================================================
   END GAME
========================================================= */

function endGame() {
  clearInterval(timerInterval);
  if (input) input.disabled = true;

  hideAutocomplete();

  const guessed =
    finalGuessedCount !== null ? finalGuessedCount : revealedCountries.size;

  document.getElementById("final-time").textContent = formatTime(secondsElapsed);
  document.getElementById("final-guessed").textContent = guessed;
  document.getElementById("final-missed").textContent = totalCountries - guessed;
  document.getElementById("final-accuracy").textContent =
    totalCountries ? Math.round((guessed / totalCountries) * 100) : 0;

  document.getElementById("endgame-overlay").classList.remove("hidden");
  document.getElementById("top-right-controls").classList.add("hidden");
  document.getElementById("continent-panel").classList.add("hidden");
}

/* =========================================================
   INIT
========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  /* ---------- MAPS ---------- */
  map = L.map("map", {
    minZoom: 2.6,
    maxZoom: 10,
    zoomSnap: 0.1,
    zoomDelta: 0.1,
    worldCopyJump: true
  }).setView([20, 0], 2.6);

  L.tileLayer(
    "https://cartodb-basemaps-a.global.ssl.fastly.net/light_nolabels/{z}/{x}/{y}.png",
    { attribution: "&copy; CartoDB" }
  ).addTo(map);

  extentMap = L.map("extent-map", {
    zoomControl: false,
    attributionControl: false,
    dragging: false,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    boxZoom: false,
    keyboard: false,
    tap: false
  }).setView([20, 0], 1.5);

  L.tileLayer(
    "https://cartodb-basemaps-a.global.ssl.fastly.net/light_nolabels/{z}/{x}/{y}.png"
  ).addTo(extentMap);

  extentRect = L.rectangle(map.getBounds(), {
    color: "#956AA2",
    weight: 2,
    fillOpacity: 0.15
  }).addTo(extentMap);

  map.on("moveend zoomend", updateExtentRectangle);

  /* ---------- UI ELEMENTS ---------- */
  input = document.getElementById("guess-input");
  autocompleteEl = document.getElementById("autocomplete");

  const startBtn = document.getElementById("start-btn");
  const giveUpBtn = document.getElementById("give-up-btn");
  const playAgainInline = document.getElementById("play-again-inline");
  const playAgainModal = document.getElementById("play-again-btn");
  const togglePanelBtn = document.getElementById("toggle-continent-panel");
  const backBtn = document.getElementById("continent-back-btn");

  input.disabled = true;

  // Initialize counters
  CONTINENTS.forEach(c => {
    continentTotals[c] = 0;
    continentGuessed[c] = 0;
  });

  // Enforce initial narrow-screen behavior
  enforceNarrowDefaults();

  /* ---------- LOAD DATA ---------- */
  fetch("countries_final.geojson")
    .then(r => {
      if (!r.ok) throw new Error(`GeoJSON load failed: ${r.status}`);
      return r.json();
    })
    .then(data => {
      const tmp = {};
      CONTINENTS.forEach(c => (tmp[c] = []));

      data.features.forEach(feature => {
        const name = feature.properties.country_name;
        if (!name) return;

        const canonical = normalizeName(name);
        countriesByCanonical[canonical] = feature;
        countryData[canonical] = feature;

        // aliases
        if (feature.properties.aliases) {
          feature.properties.aliases
            .split(",")
            .map(normalizeName)
            .filter(Boolean)
            .forEach(a => (countryData[a] = feature));
        }

        const cont = continentOfFeature(feature);
        if (!tmp[cont]) tmp[cont] = [];
        continentTotals[cont] = (continentTotals[cont] || 0) + 1;
        tmp[cont].push({ name, canonical });
      });

      CONTINENTS.forEach(cont => {
        const sorted = (tmp[cont] || []).sort((a, b) => a.name.localeCompare(b.name));
        continentCountryIndex[cont] = sorted;
        sorted.forEach((item, idx) => {
          canonicalToContinentInfo[item.canonical] = { continent: cont, index: idx };
        });
      });

      totalCountries = Object.keys(countriesByCanonical).length;
      allCountriesList = buildAllCountriesList();

      dataLoaded = true;
      updateProgress();
      updateAllContinentBoxes();
    })
    .catch(err => {
      console.error("FAILED TO LOAD COUNTRIES", err);
      alert("Failed to load countries_final.geojson. Check console for details.");
    });

  /* ---------- START GAME ---------- */
  startBtn.addEventListener("click", () => {
    if (!dataLoaded) {
      alert("Map is still loading, please wait…");
      return;
    }

    gameStarted = true;

    startBtn.classList.add("hidden");
    playAgainInline.classList.add("hidden");

    input.classList.remove("hidden");
    input.disabled = false;
    input.focus();

    document.getElementById("top-right-controls").classList.remove("hidden");

    // Panel behavior:
    // - desktop: show continent panel + extent map (grid mode)
    // - narrow: keep panel hidden by default + no extent map
    if (isNarrowScreen() && gameStarted) {
      enforceNarrowDefaults();
    } else {
      document.getElementById("continent-panel").classList.remove("hidden");
      setContinentPanelMode("grid");
      setTimeout(refreshExtentMap, 0);
    }

    secondsElapsed = 0;
    document.getElementById("timer").textContent = "00:00";

    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      secondsElapsed++;
      document.getElementById("timer").textContent = formatTime(secondsElapsed);
    }, 1000);
  });

  /* ---------- TOGGLE CONTINENT PANEL (NARROW) ---------- */
  togglePanelBtn.addEventListener("click", () => {
    const panel = document.getElementById("continent-panel");
    if (!panel) return;

    const willShow = panel.classList.contains("hidden");

    // Always keep extent hidden on narrow
    document.getElementById("extent-map-container").classList.add("hidden");

    if (willShow) {
      panel.classList.remove("hidden");
      togglePanelBtn.textContent = "Hide Continent Panel";
      setContinentPanelMode("grid");
    } else {
      panel.classList.add("hidden");
      togglePanelBtn.textContent = "Show Continent Panel";
    }
  });

  /* ---------- RESIZE ---------- */
  window.addEventListener("resize", () => {
    if (isEndgameActive()) return;

    if (isNarrowScreen() && gameStarted) {
      enforceNarrowDefaults();
      return;
    }

    // Desktop behavior
    document.getElementById("toggle-continent-panel").classList.add("hidden");

    if (document.getElementById("start-btn").classList.contains("hidden")) {
      document.getElementById("continent-panel").classList.remove("hidden");
    }

    if (continentPanelMode === "grid") {
      document.getElementById("extent-map-container").classList.remove("hidden");
      setTimeout(refreshExtentMap, 0);
    } else {
      document.getElementById("extent-map-container").classList.add("hidden");
    }

    refreshContinentGridTiles();
  });

  /* ---------- CONTINENT CARD CLICK ---------- */
  function handleContinentCardClick(continent) {
    if (isNarrowScreen() && gameStarted) {
      activeContinent = continent;
      setContinentPanelMode("list");
      renderContinentCountryList(continent);
      return;
    }

    if (continentPanelMode === "list" && continent === activeContinent) {
      setContinentPanelMode("grid");
      refreshContinentGridTiles();
      setTimeout(refreshExtentMap, 0);
      return;
    }

    activeContinent = continent;
    setContinentPanelMode("list");
    renderContinentCountryList(continent);
  }

  document.querySelectorAll(".continent-card").forEach(btn => {
    btn.addEventListener("click", () => {
      const cont = btn.dataset.continent;
      handleContinentCardClick(cont);
    });
  });

  /* ---------- BACK ---------- */
  backBtn.addEventListener("click", () => {
    activeContinent = null;
    setContinentPanelMode("grid");
    refreshContinentGridTiles();
    if (!isNarrowScreen()) setTimeout(refreshExtentMap, 0);
  });

  /* =========================================================
     AUTOCOMPLETE EVENTS
  ========================================================= */

  document.addEventListener("click", (e) => {
    if (!autocompleteEl || autocompleteEl.classList.contains("hidden")) return;

    const inWrapper = e.target.closest("#input-wrapper");
    if (!inWrapper) hideAutocomplete();
  });

  if (autocompleteEl) {
    autocompleteEl.addEventListener("mousedown", (e) => {
      const item = e.target.closest(".autocomplete-item");
      if (!item) return;

      const canonical = item.dataset.canonical;
      const feature = countriesByCanonical[canonical];
      if (!feature) return;

      // Fill input visually, then reveal immediately.
      input.value = feature.properties.country_name;
      hideAutocomplete();

      revealCountryByFeature(feature);
      input.value = "";
      input.focus();
    });
  }

  input.addEventListener("keydown", (e) => {
    if (!autocompleteEl || autocompleteEl.classList.contains("hidden")) return;

    const items = Array.from(autocompleteEl.querySelectorAll(".autocomplete-item"));
    if (!items.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeSuggestionIndex = Math.min(activeSuggestionIndex + 1, items.length - 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeSuggestionIndex = Math.max(activeSuggestionIndex - 1, 0);
    } else if (e.key === "Enter") {
      const active = items[activeSuggestionIndex];
      if (active) {
        e.preventDefault();
        active.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      }
      return;
    } else if (e.key === "Escape") {
      hideAutocomplete();
      return;
    } else {
      return;
    }

    items.forEach((el, idx) => el.classList.toggle("active", idx === activeSuggestionIndex));
    items[activeSuggestionIndex]?.scrollIntoView({ block: "nearest" });
  });

  /* ---------- GUESS INPUT (+ AUTOCOMPLETE) ---------- */
  input.addEventListener("input", () => {
    const raw = input.value;
    const guess = normalizeName(raw);

    // Autocomplete suggestions (only while game is running and input enabled)
    if (gameStarted && !input.disabled) {
      const suggestions = getSuggestions(raw, 20);
      showAutocomplete(suggestions);
    } else {
      hideAutocomplete();
    }

    // Only reveal on exact match (canonical or alias)
    if (!countryData[guess]) return;

    const feature = countryData[guess];
    const canonical = normalizeName(feature.properties.country_name);

    if (revealedCountries.has(canonical)) {
      input.value = "";
      hideAutocomplete();
      return;
    }

    hideAutocomplete();
    revealCountryByFeature(feature);
    input.value = "";
  });

  /* ---------- GIVE UP ---------- */
  giveUpBtn.addEventListener("click", () => {
    gameStarted = false;

    finalGuessedCount = revealedCountries.size;

    hideAutocomplete();

    document.getElementById("continent-panel").classList.add("hidden");
    document.getElementById("toggle-continent-panel").classList.add("hidden");

    // Remove existing guessed layers/labels
    Object.values(countryLayers).forEach(({ layer, label }) => {
      map.removeLayer(layer);
      map.removeLayer(label);
    });
    countryLayers = {};

    // Re-draw ALL countries: guessed=blue, missed=red
    Object.entries(countriesByCanonical).forEach(([canonical, feature]) => {
      const color = revealedCountries.has(canonical) ? "#1E90FF" : "#c62828";
      const layer = createCountryLayer(feature, color).addTo(map);

      const center =
        Number.isFinite(feature.properties.label_x)
          ? [feature.properties.label_y, feature.properties.label_x]
          : layer.getBounds().getCenter();

      const label = L.marker(center, {
        icon: L.divIcon({
          className: "country-label",
          html: feature.properties.country_name
        })
      }).addTo(map);

      const el = label.getElement();
      if (el) el.style.fontSize = `${getLabelFontSize(feature, map.getZoom())}px`;

      countryLayers[canonical] = { layer, label };
    });

    updateProgress();
    updateAllContinentBoxes();

    // Zoom back to global view
    map.setView([20, 0], 2.6, { animate: true, duration: 1.2 });

    endGame();
  });

  /* ---------- END GAME MODAL CLOSE (X) ---------- */
  document.getElementById("close-endgame").addEventListener("click", () => {
    document.getElementById("endgame-overlay").classList.add("hidden");

    document.getElementById("top-right-controls").classList.add("hidden");
    document.getElementById("continent-panel").classList.add("hidden");

    hideAutocomplete();

    input.classList.add("hidden");
    input.disabled = true;

    playAgainInline.classList.remove("hidden");
  });

  /* ---------- PLAY AGAIN (RESET) ---------- */
  function resetGame() {
    Object.values(countryLayers).forEach(({ layer, label }) => {
      map.removeLayer(layer);
      map.removeLayer(label);
    });

    countryLayers = {};
    revealedCountries.clear();
    finalGuessedCount = null;

    CONTINENTS.forEach(c => (continentGuessed[c] = 0));

    updateProgress();
    updateAllContinentBoxes();

    playAgainInline.classList.add("hidden");
    startBtn.classList.remove("hidden");

    hideAutocomplete();

    input.value = "";
    input.disabled = true;
    input.classList.add("hidden");

    document.getElementById("top-right-controls").classList.add("hidden");
    document.getElementById("continent-panel").classList.add("hidden");
    document.getElementById("endgame-overlay").classList.add("hidden");

    // Restore default narrow behavior
    if (isNarrowScreen() && gameStarted) {
      enforceNarrowDefaults();
    } else {
      document.getElementById("extent-map-container").classList.add("hidden");
    }

    map.setView([20, 0], 2.6);

    clearInterval(timerInterval);
    secondsElapsed = 0;
    document.getElementById("timer").textContent = "00:00";
  }

  playAgainInline.addEventListener("click", resetGame);
  playAgainModal.addEventListener("click", () => {
    document.getElementById("endgame-overlay").classList.add("hidden");
    resetGame();
  });
});
