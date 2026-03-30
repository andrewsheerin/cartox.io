import pointOnFeature from '@turf/point-on-feature';

export function normalizeName(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function baseLabelSizeFromArea(areaSqkm) {
  if (!Number.isFinite(areaSqkm)) return 11;
  if (areaSqkm > 3000000) return 15;
  if (areaSqkm > 1200000) return 14;
  if (areaSqkm > 300000) return 13;
  if (areaSqkm > 100000) return 12;
  return 11;
}

export function buildGameData(geoJson) {
  const countriesByCanonical = {};
  const aliases = {};
  const continentTotals = {};
  const continentCountryIndex = {};

  const mappedFeatures = geoJson.features.map((feature) => {
    const countryName = feature?.properties?.country_name;
    const canonical = normalizeName(countryName);

    if (!countryName || !canonical) {
      return {
        ...feature,
        properties: {
          ...feature.properties,
          canonical,
          status: 'default'
        }
      };
    }

    countriesByCanonical[canonical] = feature;
    aliases[canonical] = canonical;

    const rawAliases = feature?.properties?.aliases;
    if (typeof rawAliases === 'string' && rawAliases.trim()) {
      rawAliases
        .split(',')
        .map((part) => normalizeName(part))
        .filter(Boolean)
        .forEach((alias) => {
          aliases[alias] = canonical;
        });
    }

    const continent = feature?.properties?.continent ?? 'Other';
    continentTotals[continent] = (continentTotals[continent] ?? 0) + 1;
    if (!continentCountryIndex[continent]) {
      continentCountryIndex[continent] = [];
    }
    continentCountryIndex[continent].push({
      canonical,
      name: countryName
    });

    return {
      ...feature,
      properties: {
        ...feature.properties,
        canonical,
        status: 'default'
      }
    };
  });

  const labels = {
    type: 'FeatureCollection',
    features: mappedFeatures
      .filter((feature) => feature?.properties?.country_name)
      .map((feature) => {
        const point = pointOnFeature(feature);
        const areaSqkm = Number(feature?.properties?.area_sqkm);

        return {
          type: 'Feature',
          geometry: point.geometry,
          properties: {
            canonical: feature.properties.canonical,
            countryName: feature.properties.country_name,
            areaSqkm,
            labelBaseSize: baseLabelSizeFromArea(areaSqkm),
            status: 'default'
          }
        };
      })
  };

  Object.values(continentCountryIndex).forEach((countryList) => {
    countryList.sort((a, b) => a.name.localeCompare(b.name));
  });

  return {
    countriesByCanonical,
    aliases,
    continentTotals,
    continentCountryIndex,
    geoJsonWithStatus: {
      type: 'FeatureCollection',
      features: mappedFeatures
    },
    labelPoints: labels
  };
}

export function withStatus(geoJson, statusByCanonical) {
  return {
    ...geoJson,
    features: geoJson.features.map((feature) => {
      const canonical = feature?.properties?.canonical;
      const status = statusByCanonical[canonical] ?? 'default';

      return {
        ...feature,
        properties: {
          ...feature.properties,
          status
        }
      };
    })
  };
}

export function getFeatureBounds(feature) {
  const bounds = {
    minLng: Infinity,
    minLat: Infinity,
    maxLng: -Infinity,
    maxLat: -Infinity
  };

  function walkCoordinates(coordinates) {
    if (!Array.isArray(coordinates)) return;

    if (typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
      const [lng, lat] = coordinates;
      bounds.minLng = Math.min(bounds.minLng, lng);
      bounds.minLat = Math.min(bounds.minLat, lat);
      bounds.maxLng = Math.max(bounds.maxLng, lng);
      bounds.maxLat = Math.max(bounds.maxLat, lat);
      return;
    }

    coordinates.forEach(walkCoordinates);
  }

  walkCoordinates(feature?.geometry?.coordinates);

  if (!Number.isFinite(bounds.minLng)) {
    return null;
  }

  return bounds;
}


