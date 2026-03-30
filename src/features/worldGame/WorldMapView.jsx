import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { getFeatureBounds } from './gameUtils';

const countriesSourceId = 'countries-source';
const labelsSourceId = 'labels-source';
const mobileMediaQuery = '(max-width: 768px), (pointer: coarse)';

const baseStyle = {
  version: 8,
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {},
  layers: [
    {
      id: 'ocean-background',
      type: 'background',
      paint: {
        'background-color': '#8f98a4'
      }
    }
  ]
};

function getViewportMapConfig() {
  const isMobileViewport = window.matchMedia(mobileMediaQuery).matches;

  if (isMobileViewport) {
    const minZoom = 1.4;

    return {
      homeCenter: [0, 18],
      homeZoom: minZoom,
      minZoom,
      maxZoom: 8.2,
      focusMaxZoom: 2.65,
      autoFocusHardCap: 2.25,
      autoFocusMaxStep: 0.85,
      focusPadding: { top: 56, right: 44, bottom: 56, left: 44 }
    };
  }

  const minZoom = 1.8;

  return {
    homeCenter: [0, 20],
    homeZoom: minZoom,
    minZoom,
    maxZoom: 8.5,
    focusMaxZoom: 2.9,
    autoFocusHardCap: 2.55,
    autoFocusMaxStep: 0.95,
    focusPadding: { top: 72, right: 72, bottom: 72, left: 72 }
  };
}

function getFocusMaxZoom(feature, viewportConfig) {
  const areaSqkm = Number(feature?.properties?.area_sqkm);
  const baseMaxZoom = viewportConfig.focusMaxZoom;

  if (!Number.isFinite(areaSqkm)) return baseMaxZoom;
  if (areaSqkm < 1500) return baseMaxZoom + 1.6;
  if (areaSqkm < 10000) return baseMaxZoom + 1.05;
  if (areaSqkm < 50000) return baseMaxZoom + 0.44;
  if (areaSqkm < 150000) return baseMaxZoom + 0.15;
  if (areaSqkm > 3000000) return Math.max(viewportConfig.minZoom + 0.83, baseMaxZoom - 0.72);
  if (areaSqkm > 1000000) return Math.max(viewportConfig.minZoom + 1.00, baseMaxZoom - 0.48);
  if (areaSqkm > 300000) return Math.max(viewportConfig.minZoom + 1.1, baseMaxZoom - 0.25);
  return baseMaxZoom;
}

function clearPendingTimeouts(timeoutIdsRef) {
  timeoutIdsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
  timeoutIdsRef.current = [];
}

function setHomeView(map, timeoutIdsRef, viewportConfig, { animate = false } = {}) {
  clearPendingTimeouts(timeoutIdsRef);
  map.setProjection({ type: 'globe' });

  const camera = {
    center: viewportConfig.homeCenter,
    zoom: viewportConfig.minZoom,
    duration: animate ? 650 : 0,
    essential: true
  };

  if (animate) {
    map.easeTo(camera);
  } else {
    map.jumpTo(camera);
  }
}

function focusOnFeature(map, feature, timeoutIdsRef, viewportConfig) {
  const rawBounds = getFeatureBounds(feature);
  if (!rawBounds) return;

  clearPendingTimeouts(timeoutIdsRef);

  const bounds = [
    [rawBounds.minLng, rawBounds.minLat],
    [rawBounds.maxLng, rawBounds.maxLat]
  ];

  const focusMaxZoom = getFocusMaxZoom(feature, viewportConfig);
  const camera = map.cameraForBounds(bounds, {
    padding: viewportConfig.focusPadding,
    maxZoom: focusMaxZoom
  });

  if (!camera?.center || !Number.isFinite(camera.zoom)) return;

  const guardedZoom = Math.min(
    camera.zoom,
    viewportConfig.autoFocusHardCap,
    map.getZoom() + viewportConfig.autoFocusMaxStep
  );

  map.setProjection({ type: 'globe' });
  map.easeTo({
    center: camera.center,
    zoom: guardedZoom,
    duration: 1650,
    essential: true
  });
}

export default function WorldMapView({
  countriesData,
  labelData,
  focusTarget,
  gamePhase,
  showCountryOutlines
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const timeoutIdsRef = useRef([]);
  const latestFocusIdRef = useRef(null);
  const viewportConfigRef = useRef(getViewportMapConfig());
  const mapLoadedRef = useRef(false);
  const focusTargetRef = useRef(focusTarget);

  useEffect(() => {
    focusTargetRef.current = focusTarget;
  }, [focusTarget]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    viewportConfigRef.current = getViewportMapConfig();

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: baseStyle,
      center: viewportConfigRef.current.homeCenter,
      zoom: viewportConfigRef.current.homeZoom,
      minZoom: viewportConfigRef.current.minZoom,
      maxZoom: viewportConfigRef.current.maxZoom,
      projection: { type: 'globe' },
      attributionControl: false
    });

    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');

    map.on('load', () => {
      mapLoadedRef.current = true;

      map.addSource(countriesSourceId, {
        type: 'geojson',
        data: countriesData
      });

      map.addLayer({
        id: 'landmass-fill',
        type: 'fill',
        source: countriesSourceId,
        paint: {
          'fill-color': '#dde2e8',
          'fill-opacity': 1,
          'fill-antialias': false
        }
      });

      map.addLayer({
        id: 'countries-fill',
        type: 'fill',
        source: countriesSourceId,
        paint: {
          'fill-color': [
            'match',
            ['get', 'status'],
            'guessed',
            '#4ade80',
            'missed',
            '#ef4444',
            '#607089'
          ],
          'fill-opacity': [
            'match',
            ['get', 'status'],
            'guessed',
            0.74,
            'missed',
            0.6,
            0
          ]
        }
      });

      map.addLayer({
        id: 'countries-outline',
        type: 'line',
        source: countriesSourceId,
        paint: {
          'line-color': '#2a3248',
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            1,
            0.4,
            4,
            1,
            8,
            1.6
          ]
        },
        layout: {
          visibility: showCountryOutlines ? 'visible' : 'none'
        }
      });

      map.addLayer({
        id: 'countries-guessed-outline',
        type: 'line',
        source: countriesSourceId,
        paint: {
          'line-color': '#22d3ee',
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            1,
            1.1,
            4,
            2.2,
            8,
            3.3
          ],
          'line-opacity': 0.92,
          'line-blur': 0.45
        },
        filter: ['==', ['get', 'status'], 'guessed']
      });

      map.addSource(labelsSourceId, {
        type: 'geojson',
        data: labelData
      });

      map.addLayer({
        id: 'country-labels',
        type: 'symbol',
        source: labelsSourceId,
        layout: {
          'text-field': ['get', 'countryName'],
          'text-font': ['Open Sans Semibold', 'Arial Unicode MS Regular'],
          'symbol-sort-key': ['get', 'areaSqkm'],
          'text-size': [
            'interpolate',
            ['linear'],
            ['zoom'],
            1,
            ['*', ['get', 'labelBaseSize'], 0.68],
            4,
            ['*', ['get', 'labelBaseSize'], 0.95],
            8,
            ['*', ['get', 'labelBaseSize'], 1.22]
          ],
          'text-anchor': 'center',
          'text-allow-overlap': false,
          'text-padding': 3
        },
        paint: {
          'text-color': '#111827',
          'text-halo-color': '#e7ecf4',
          'text-halo-width': 1.35,
          'text-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            1,
            0.35,
            3,
            0.6,
            5,
            0.9
          ]
        },
        filter: ['in', ['get', 'status'], ['literal', ['guessed', 'missed']]]
      });

      setHomeView(map, timeoutIdsRef, viewportConfigRef.current);
    });

    const onResize = () => {
      const nextConfig = getViewportMapConfig();
      viewportConfigRef.current = nextConfig;

      map.setMinZoom(nextConfig.minZoom);
      map.setMaxZoom(nextConfig.maxZoom);
      map.setProjection({ type: 'globe' });
      map.resize();

      if (!focusTargetRef.current?.feature) {
        setHomeView(map, timeoutIdsRef, nextConfig);
      }
    };

    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      clearPendingTimeouts(timeoutIdsRef);
      mapLoadedRef.current = false;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoadedRef.current) return;


    if (map.getLayer('countries-outline')) {
      map.setLayoutProperty(
        'countries-outline',
        'visibility',
        showCountryOutlines ? 'visible' : 'none'
      );
    }
  }, [showCountryOutlines]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoadedRef.current || !countriesData) return;

    const source = map.getSource(countriesSourceId);
    if (source) {
      source.setData(countriesData);
    }
  }, [countriesData]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoadedRef.current || !labelData) return;

    const source = map.getSource(labelsSourceId);
    if (source) {
      source.setData(labelData);
    }
  }, [labelData]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoadedRef.current || !focusTarget?.feature || latestFocusIdRef.current === focusTarget.id) return;

    latestFocusIdRef.current = focusTarget.id;
    focusOnFeature(map, focusTarget.feature, timeoutIdsRef, viewportConfigRef.current);
  }, [focusTarget]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoadedRef.current || gamePhase !== 'idle') return;

    latestFocusIdRef.current = null;
    setHomeView(map, timeoutIdsRef, viewportConfigRef.current, { animate: true });
  }, [gamePhase]);

  return <div ref={mapContainerRef} className="gameMap gameMap--abyss" aria-label="Cartox map" />;
}



