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

/* ---------- END GAME ---------- */
function endGame() {
  clearInterval(timerInterval);
  input.disabled = true;

  const guessed =
    finalGuessedCount !== null
      ? finalGuessedCount
      : revealedCountries.size;

  document.getElementById("final-time").textContent =
    formatTime(secondsElapsed);
  document.getElementById("final-guessed").textContent = guessed;
  document.getElementById("final-missed").textContent =
    totalCountries - guessed;
  document.getElementById("final-accuracy").textContent =
    Math.round((guessed / totalCountries) * 100);

  document.getElementById("endgame-overlay").classList.remove("hidden");
  document.getElementById("top-right-controls").classList.add("hidden");
}

/* ---------- INIT ---------- */
document.addEventListener("DOMContentLoaded", () => {

  map = L.map("map", {
    minZoom: 2.6,
    maxZoom: 10,
    zoomSnap: 0.1,
    zoomDelta: 0.1,
    worldCopyJump: false,
    maxBounds: [[-90, -180], [90, 180]]
  }).setView([20, 0], 2.6);

  L.tileLayer(
    "https://cartodb-basemaps-a.global.ssl.fastly.net/light_nolabels/{z}/{x}/{y}.png",
    { attribution: "&copy; CartoDB", noWrap: false }
  ).addTo(map);

  input = document.getElementById("guess-input");
  const startBtn = document.getElementById("start-btn");
  const clearBtn = document.getElementById("clear-btn");
  const giveUpBtn = document.getElementById("give-up-btn");
  const playAgainInline = document.getElementById("play-again-inline");

  input.disabled = true;

  /* ---------- LOAD DATA ---------- */
  fetch("/static/countries_updated.geojson")
    .then(r => r.json())
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
      });

      totalCountries = Object.keys(countriesByCanonical).length;
      dataLoaded = true;
      updateProgress();
    });

  /* ---------- START GAME ---------- */
  startBtn.addEventListener("click", () => {
    if (!dataLoaded) return alert("Loading map data…");

    startBtn.classList.add("hidden");
    playAgainInline.classList.add("hidden");
    input.classList.remove("hidden");
    clearBtn.classList.remove("hidden");
    input.disabled = false;
    input.focus();

    document.getElementById("top-right-controls").classList.remove("hidden");

    secondsElapsed = 0;
    document.getElementById("timer").textContent = "00:00";

    timerInterval = setInterval(() => {
      secondsElapsed++;
      document.getElementById("timer").textContent =
        formatTime(secondsElapsed);
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

    label.getElement().style.fontSize =
      `${getLabelFontSize(feature, map.getZoom())}px`;

    countryLayers[canonical] = { layer, label, feature };
    revealedCountries.add(canonical);
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
    finalGuessedCount = revealedCountries.size;

    Object.values(countryLayers).forEach(({ layer, label }) => {
      map.removeLayer(layer);
      map.removeLayer(label);
    });
    countryLayers = {};

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

    revealedCountries = new Set(Object.keys(countryLayers));
    updateProgress();
    map.setView([20, 0], 2.6, { animate: true, duration: 2 });
    endGame();
  });

  /* ---------- CLOSE MODAL → SHOW PLAY AGAIN INLINE ---------- */
  document.getElementById("close-endgame").addEventListener("click", () => {
    document.getElementById("endgame-overlay").classList.add("hidden");

    input.classList.add("hidden");
    clearBtn.classList.add("hidden");
    playAgainInline.classList.remove("hidden");
  });

  /* ---------- PLAY AGAIN INLINE ---------- */
  playAgainInline.addEventListener("click", () => {
    Object.values(countryLayers).forEach(({ layer, label }) => {
      map.removeLayer(layer);
      map.removeLayer(label);
    });

    countryLayers = {};
    revealedCountries.clear();
    finalGuessedCount = null;

    updateProgress();

    playAgainInline.classList.add("hidden");
    startBtn.classList.remove("hidden");

    map.setView([20, 0], 2.6, { animate: true, duration: 1.5 });
  });

});
