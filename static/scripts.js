let map;
let countryLayers = {};       // key: country name, value: layer
let revealedCountries = new Set();  // track which are shown
let totalCountries = 0;

document.addEventListener("DOMContentLoaded", () => {
    console.log("Initializing map...");

    map = L.map("map", {
        minZoom: 2,
        maxZoom: 6
    }).setView([20, 0], 2);

    L.tileLayer(
        "https://cartodb-basemaps-a.global.ssl.fastly.net/light_nolabels/{z}/{x}/{y}.png",
        {
         attribution: "&copy; CartoDB",
         nowrap: true,
         }
    ).addTo(map);

    // Load GeoJSON
    fetch("/static/countries.geo.json")
        .then(res => res.json())
        .then(data => {
            totalCountries = data.features.length;

            data.features.forEach(feature => {
                const name = feature.properties.name_en;
                if (!name) return;

                const key = name.toLowerCase();

                const layer = L.geoJSON(feature, {
                    style: {
                        color: "#1E90FF",
                        weight: 2,
                        fillColor: "#1E90FF",
                        fillOpacity: 0.45
                    }
                });

                countryLayers[key] = layer;
            });

            updateProgress();
        });

    //------------------------------------------------------------------
    // AUTO-DETECT COUNTRY GUESSING (NO ENTER KEY REQUIRED)
    //------------------------------------------------------------------

    const input = document.getElementById("guess-input");

    input.addEventListener("input", () => {
        const guess = input.value.trim().toLowerCase();
        if (!guess) return;

        const layer = countryLayers[guess];

        // If not an exact country match → do nothing
        if (!layer) return;

        // If already revealed → do NOT clear the box
        if (revealedCountries.has(guess)) {
            return;
        }

        // Otherwise: reveal the country for the first time
        layer.addTo(map);
        revealedCountries.add(guess);
        updateProgress();
        map.fitBounds(layer.getBounds(), { padding: [20, 20] });

        // NOW clear the text box — FIRST TIME ONLY
        input.value = "";
        input.focus();
    });



    //------------------------------------------------------------------
    // CLEAR BUTTON — remove all revealed layers
    //------------------------------------------------------------------

    const clearBtn = document.getElementById("clear-btn");

    clearBtn.addEventListener("click", () => {
        input.value = "";
        input.focus();
    });


});

//------------------------------------------------------------------
// UPDATE PROGRESS
//------------------------------------------------------------------
function updateProgress() {
    const tracker = document.getElementById("progress-tracker");
    tracker.textContent = `${revealedCountries.size} / ${totalCountries}`;
}
