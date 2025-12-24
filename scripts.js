let map;
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

/* ---------- CONTINENTS ---------- */
/**
 * These must match EXACTLY what your GeoJSON "continent" field contains.
 * If your geojson uses different strings (e.g., "NA", "SA"), change them here.
 */
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

let continentTotals = {};   // { "Europe": 44, ... }
let continentGuessed = {};  // { "Europe": 10, ... }

/* ---------- HELPERS ---------- */
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
  if (!id) return;

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

/* ---------- END GAME ---------- */
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

  // Build continent stats inside the modal
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

  // Hide timer + give up until a new game starts (your requirement)
  document.getElementById("top-right-controls").classList.add("hidden");

  document.getElementById("continental-panel").classList.add("hidden");
}

/* ---------- INIT ---------- */
document.addEventListener("DOMContentLoaded", () => {

  map = L.map("map", {
    minZoom: 2.6,
    maxZoom: 10,
    zoomSnap: 0.1,
    zoomDelta: 0.1,
    worldCopyJump: true,
    // maxBounds: [[-80, -180], [90, 180]]
  }).setView([20, 0], 2.6);

  L.tileLayer(
    "https://cartodb-basemaps-a.global.ssl.fastly.net/light_nolabels/{z}/{x}/{y}.png",
    {
    attribution: "&copy; CartoDB",
    noWrap: false
     }
  ).addTo(map);

  input = document.getElementById("guess-input");
  const startBtn = document.getElementById("start-btn");
  const clearBtn = document.getElementById("clear-btn");
  const giveUpBtn = document.getElementById("give-up-btn");
  const playAgainInline = document.getElementById("play-again-inline");
  const playAgainModal = document.getElementById("play-again-btn");

  input.disabled = true;

  // init continent counters
  CONTINENTS.forEach(c => {
    continentTotals[c] = 0;
    continentGuessed[c] = 0;
  });

  /* ---------- LOAD DATA ---------- */
fetch("countries_updated.geojson")
  .then(r => {
    if (!r.ok) {
      throw new Error(`Failed to load GeoJSON: ${r.status}`);
    }
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
      if (continentTotals[cont] === undefined) continentTotals[cont] = 0;
      continentTotals[cont]++;
    });

    totalCountries = Object.keys(countriesByCanonical).length;
    dataLoaded = true;

    updateProgress();
    updateAllContinentBoxes();
  })
  .catch(err => {
    console.error(err);
    alert("Failed to load map data. Check console.");
  });


  /* ---------- START GAME ---------- */
  startBtn.addEventListener("click", () => {
    // if (!dataLoaded) return alert("Loading map data…");

    startBtn.classList.add("hidden");
    playAgainInline.classList.add("hidden");

    input.classList.remove("hidden");
    clearBtn.classList.remove("hidden");
    input.disabled = false;
    input.focus();

    document.getElementById("top-right-controls").classList.remove("hidden");
    document.getElementById("continent-panel").classList.remove("hidden");

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

    const { label_x, label_y } = feature.properties;
    const center =
      Number.isFinite(label_x) && Number.isFinite(label_y)
        ? [label_y, label_x]
        : layer.getBounds().getCenter();

    const label = L.marker(center, {
      icon: L.divIcon({
        className: "country-label",
        html: feature.properties.country_name
      })
    }).addTo(map);

    // font size based on zoom
    label.getElement().style.fontSize =
      `${getLabelFontSize(feature, map.getZoom())}px`;

    countryLayers[canonical] = { layer, label, feature };
    revealedCountries.add(canonical);

    // continent guessed + UI update
    const cont = continentOfFeature(feature);
    if (continentGuessed[cont] === undefined) continentGuessed[cont] = 0;
    continentGuessed[cont]++;
    updateContinentBox(cont);

    updateProgress();

    map.fitBounds(layer.getBounds(), {
      padding: [20, 20],
      maxZoom: 5,
      animate: true
    });

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
    // freeze guessed count for modal
    finalGuessedCount = revealedCountries.size;

    // remove currently drawn layers
    Object.values(countryLayers).forEach(({ layer, label }) => {
      map.removeLayer(layer);
      map.removeLayer(label);
    });
    countryLayers = {};

    // draw ALL countries: guessed = blue, missed = red
    Object.entries(countriesByCanonical).forEach(([canonical, feature]) => {
      const color = revealedCountries.has(canonical)
        ? "#1E90FF"
        : "#c62828";

      const layer = createCountryLayer(feature, color).addTo(map);

      const { label_x, label_y } = feature.properties;
      const center =
        Number.isFinite(label_x) && Number.isFinite(label_y)
          ? [label_y, label_x]
          : layer.getBounds().getCenter();

      const label = L.marker(center, {
        icon: L.divIcon({
          className: "country-label",
          html: feature.properties.country_name
        })
      }).addTo(map);

      label.getElement().style.fontSize =
        `${getLabelFontSize(feature, map.getZoom())}px`;

      countryLayers[canonical] = { layer, label, feature };
    });

    updateProgress();
    updateAllContinentBoxes();

    // zoom out to global view
    map.setView([20, 0], 2.6, { animate: true, duration: 1.5 });

    const continentCard = document.getElementById("continent-panel");
    if (continentCard) continentCard.classList.add("hidden");

    endGame();
  });

  /* ---------- CLOSE MODAL → EXPLORE MODE (SHOW PLAY AGAIN INLINE) ---------- */
  document.getElementById("close-endgame").addEventListener("click", () => {
    document.getElementById("endgame-overlay").classList.add("hidden");

    // hide input + clear, show play again inline where input was
    input.classList.add("hidden");
    clearBtn.classList.add("hidden");
    playAgainInline.classList.remove("hidden");
  });

  /* ---------- PLAY AGAIN (INLINE) ---------- */
  function resetGameToStartButton() {
    // remove all drawn layers (including give-up reveal)
    Object.values(countryLayers).forEach(({ layer, label }) => {
      map.removeLayer(layer);
      map.removeLayer(label);
    });

    countryLayers = {};
    revealedCountries.clear();
    finalGuessedCount = null;

    // reset continent guessed
    CONTINENTS.forEach(c => { continentGuessed[c] = 0; });

    updateProgress();
    updateAllContinentBoxes();

    // UI back to "Begin Game"
    playAgainInline.classList.add("hidden");
    startBtn.classList.remove("hidden");


    // also hide input/clear, since we’re back to pre-game state
    input.value = "";
    input.disabled = true;
    input.classList.add("hidden");
    clearBtn.classList.add("hidden");

    // hide top-right controls until game starts again
    document.getElementById("top-right-controls").classList.add("hidden");

    // zoom to world
    map.setView([20, 0], 2.6, { animate: true, duration: 1.2 });

    // reset timer display
    clearInterval(timerInterval);
    secondsElapsed = 0;
    document.getElementById("timer").textContent = "00:00";
  }

  playAgainInline.addEventListener("click", resetGameToStartButton);

  /* ---------- PLAY AGAIN (MODAL BUTTON) ---------- */
  playAgainModal.addEventListener("click", () => {
    document.getElementById("endgame-overlay").classList.add("hidden");
    resetGameToStartButton();
  });

});
