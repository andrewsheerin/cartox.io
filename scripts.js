/* =========================================================
   GLOBAL STATE
========================================================= */

let map;
let extentMap;
let extentRect;

let countryData = {};
let countriesByCanonical = {};
let countryLayers = {};
let revealedCountries = new Set();
let finalGuessedCount = null;

let totalCountries = 0;
let input;
let dataLoaded = false;

let timerInterval = null;
let secondsElapsed = 0;

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

/* =========================================================
   HELPERS
========================================================= */

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

/* =========================================================
   EXTENT MAP SYNC
========================================================= */

function updateExtentRectangle() {
  if (!extentRect) return;
  extentRect.setBounds(map.getBounds());
}

/* =========================================================
   END GAME
========================================================= */

function endGame() {
  clearInterval(timerInterval);
  input.disabled = true;

  const guessed =
    finalGuessedCount !== null
      ? finalGuessedCount
      : revealedCountries.size;

  document.getElementById("final-time").textContent = formatTime(secondsElapsed);
  document.getElementById("final-guessed").textContent = guessed;
  document.getElementById("final-missed").textContent = totalCountries - guessed;
  document.getElementById("final-accuracy").textContent =
    Math.round((guessed / totalCountries) * 100);

  const continentStats = document.getElementById("continent-stats");
  continentStats.innerHTML = "";

  CONTINENTS.forEach(c => {
    const card = document.createElement("div");
    card.className = "stat-card";
    card.innerHTML = `
      <div class="stat-label">${c}</div>
      <div class="stat-value">${continentGuessed[c] || 0} / ${continentTotals[c] || 0}</div>
    `;
    continentStats.appendChild(card);
  });

  document.getElementById("endgame-overlay").classList.remove("hidden");
  document.getElementById("top-right-controls").classList.add("hidden");
  document.getElementById("continent-panel").classList.add("hidden");
}

/* =========================================================
   INIT
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

  /* ---------- MAIN MAP ---------- */
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

  /* ---------- EXTENT MAP ---------- */
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
  const startBtn = document.getElementById("start-btn");
  const clearBtn = document.getElementById("clear-btn");
  const giveUpBtn = document.getElementById("give-up-btn");
  const playAgainInline = document.getElementById("play-again-inline");
  const playAgainModal = document.getElementById("play-again-btn");

  input.disabled = true;
  document.getElementById("extent-map-container").classList.add("hidden");

  CONTINENTS.forEach(c => {
    continentTotals[c] = 0;
    continentGuessed[c] = 0;
  });

  /* ---------- LOAD DATA ---------- */
  fetch("countries_final.geojson")
    .then(r => {
      if (!r.ok) throw new Error(`GeoJSON load failed: ${r.status}`);
      return r.json();
    })
    .then(data => {
      data.features.forEach(feature => {
        const name = feature.properties.country_name;
        if (!name) return;

        const canonical = normalizeName(name);
        countriesByCanonical[canonical] = feature;
        countryData[canonical] = feature;

        if (feature.properties.aliases) {
          feature.properties.aliases
            .split(",")
            .map(normalizeName)
            .forEach(a => (countryData[a] = feature));
        }

        const cont = continentOfFeature(feature);
        continentTotals[cont]++;
      });

      totalCountries = Object.keys(countriesByCanonical).length;
      dataLoaded = true;
      updateProgress();
      updateAllContinentBoxes();
    });

  /* ---------- START GAME ---------- */
  startBtn.addEventListener("click", () => {
    if (!dataLoaded) {
      alert("Map is still loading, please wait…");
      return;
    }

    startBtn.classList.add("hidden");
    playAgainInline.classList.add("hidden");

    input.classList.remove("hidden");
    clearBtn.classList.remove("hidden");
    input.disabled = false;
    input.focus();

    document.getElementById("top-right-controls").classList.remove("hidden");
    document.getElementById("continent-panel").classList.remove("hidden");
    document.getElementById("extent-map-container").classList.remove("hidden");

    setTimeout(() => {
      extentMap.invalidateSize();
      extentMap.fitWorld({ animate: false });
      updateExtentRectangle();
    }, 0);


    updateExtentRectangle();

    secondsElapsed = 0;
    document.getElementById("timer").textContent = "00:00";

    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      secondsElapsed++;
      document.getElementById("timer").textContent = formatTime(secondsElapsed);
    }, 1000);
  });

  /* ---------- GUESS INPUT ---------- */
  input.addEventListener("input", () => {
    const guess = normalizeName(input.value);
    if (!countryData[guess]) return;

    const feature = countryData[guess];
    const canonical = normalizeName(feature.properties.country_name);
    if (revealedCountries.has(canonical)) return;

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

    label.getElement().style.fontSize =
      `${getLabelFontSize(feature, map.getZoom())}px`;

    countryLayers[canonical] = { layer, label };
    revealedCountries.add(canonical);

    const cont = continentOfFeature(feature);
    continentGuessed[cont]++;
    updateContinentBox(cont);
    updateProgress();

    map.fitBounds(layer.getBounds(), { padding: [20, 20], maxZoom: 5 });

    if (revealedCountries.size === totalCountries)
      setTimeout(endGame, 1000);

    input.value = "";
  });

  /* ---------- CLEAR ---------- */
  clearBtn.addEventListener("click", () => {
    input.value = "";
    input.focus();
  });


    /* ---------- GIVE UP ---------- */
    giveUpBtn.addEventListener("click", () => {
      finalGuessedCount = revealedCountries.size;

      // Remove all current layers + labels
      Object.values(countryLayers).forEach(({ layer, label }) => {
        map.removeLayer(layer);
        map.removeLayer(label);
      });
      countryLayers = {};

      // Re-draw ALL countries with labels
      Object.entries(countriesByCanonical).forEach(([canonical, feature]) => {
        const color = revealedCountries.has(canonical)
          ? "#1E90FF"   // guessed
          : "#c62828";  // missed

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

        label.getElement().style.fontSize =
          `${getLabelFontSize(feature, map.getZoom())}px`;

        countryLayers[canonical] = { layer, label };
      });

      updateProgress();
      updateAllContinentBoxes();

      // Zoom back to global view
      map.setView([20, 0], 2.6, { animate: true, duration: 1.2 });

      endGame();
    });


  /* ---------- MODAL CLOSE ---------- */
  document.getElementById("close-endgame").addEventListener("click", () => {
    document.getElementById("endgame-overlay").classList.add("hidden");
    input.classList.add("hidden");
    clearBtn.classList.add("hidden");
    playAgainInline.classList.remove("hidden");
  });

  /* ---------- PLAY AGAIN ---------- */
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

    input.value = "";
    input.disabled = true;
    input.classList.add("hidden");
    clearBtn.classList.add("hidden");

    document.getElementById("top-right-controls").classList.add("hidden");
    document.getElementById("extent-map-container").classList.add("hidden");

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
