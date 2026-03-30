import { useEffect, useMemo, useState } from 'react';
import { buildGameData, normalizeName, withStatus } from './gameUtils';

const initialGameState = {
  loading: true,
  error: null,
  gamePhase: 'idle',
  totalCountries: 0,
  guessedCount: 0,
  missedCount: 0,
  secondsElapsed: 0,
  geoJson: null,
  labelPoints: null,
  countriesByCanonical: {},
  aliases: {},
  continentTotals: {},
  continentCountryIndex: {},
  continentGuessed: {},
  suggestions: [],
  summary: null,
  latestGuessCanonical: null,
  latestGuessContinent: null,
  guessSequence: 0
};

export default function useWorldCountryGame() {
  const [state, setState] = useState(initialGameState);
  const [statusByCanonical, setStatusByCanonical] = useState({});
  const [query, setQuery] = useState('');

  const resolveCanonicalGuess = (rawGuess) => {
    const normalized = normalizeName(rawGuess);
    if (!normalized) return null;
    return state.aliases[normalized] ?? null;
  };

  const isCanonicalCountryNameMatch = (rawGuess) => {
    const normalized = normalizeName(rawGuess);
    if (!normalized) return false;

    const feature = state.countriesByCanonical[normalized];
    return normalizeName(feature?.properties?.country_name) === normalized;
  };

  const hasCompetingCountryPrefix = (normalized, canonical) => {
    return Object.entries(state.countriesByCanonical).some(([otherCanonical, feature]) => {
      if (otherCanonical === canonical) return false;
      if (statusByCanonical[otherCanonical] === 'guessed') return false;

      const countryName = normalizeName(feature?.properties?.country_name);
      return countryName.startsWith(normalized);
    });
  };

  const shouldAutoSubmit = (rawGuess) => {
    const normalized = normalizeName(rawGuess);
    if (!normalized) return false;

    const canonical = resolveCanonicalGuess(rawGuess);
    if (!canonical) return false;

    if (isCanonicalCountryNameMatch(rawGuess)) {
      return true;
    }

    return !hasCompetingCountryPrefix(normalized, canonical);
  };

  useEffect(() => {
    let isAlive = true;

    fetch(`${import.meta.env.BASE_URL}countries_final.geojson`)
      .then((response) => {
        if (!response.ok) throw new Error(`GeoJSON fetch failed: ${response.status}`);
        return response.json();
      })
      .then((geoJson) => {
        if (!isAlive) return;

        const built = buildGameData(geoJson);
        const totalCountries = Object.keys(built.countriesByCanonical).length;

        setState((current) => ({
          ...current,
          loading: false,
          error: null,
          totalCountries,
          geoJson: built.geoJsonWithStatus,
          labelPoints: built.labelPoints,
          countriesByCanonical: built.countriesByCanonical,
          aliases: built.aliases,
          continentTotals: built.continentTotals,
          continentCountryIndex: built.continentCountryIndex,
          continentGuessed: Object.fromEntries(
            Object.keys(built.continentTotals).map((continent) => [continent, 0])
          )
        }));
      })
      .catch((error) => {
        if (!isAlive) return;
        setState((current) => ({
          ...current,
          loading: false,
          error: error.message
        }));
      });

    return () => {
      isAlive = false;
    };
  }, []);

  useEffect(() => {
    if (state.gamePhase !== 'running') return undefined;

    const timer = window.setInterval(() => {
      setState((current) => ({
        ...current,
        secondsElapsed: current.secondsElapsed + 1
      }));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [state.gamePhase]);

  const displayGeoJson = useMemo(() => {
    if (!state.geoJson) return null;
    return withStatus(state.geoJson, statusByCanonical);
  }, [state.geoJson, statusByCanonical]);

  const displayLabelPoints = useMemo(() => {
    if (!state.labelPoints) return null;
    return withStatus(state.labelPoints, statusByCanonical);
  }, [state.labelPoints, statusByCanonical]);

  const guessedCountriesByContinent = useMemo(() => {
    const grouped = Object.fromEntries(
      Object.keys(state.continentTotals).map((continent) => [continent, []])
    );

    Object.entries(statusByCanonical).forEach(([canonical, status]) => {
      if (status !== 'guessed') return;

      const feature = state.countriesByCanonical[canonical];
      const continent = feature?.properties?.continent ?? 'Other';
      const countryName = feature?.properties?.country_name;

      if (!countryName) return;
      if (!grouped[continent]) grouped[continent] = [];
      grouped[continent].push(countryName);
    });

    Object.values(grouped).forEach((countryNames) => countryNames.sort((a, b) => a.localeCompare(b)));

    return grouped;
  }, [state.continentTotals, state.countriesByCanonical, statusByCanonical]);

  const continentCountryRows = useMemo(() => {
    return Object.fromEntries(
      Object.entries(state.continentCountryIndex).map(([continent, countries]) => [
        continent,
        countries.map((country) => ({
          ...country,
          guessed: statusByCanonical[country.canonical] === 'guessed'
        }))
      ])
    );
  }, [state.continentCountryIndex, statusByCanonical]);

  const focusTarget = useMemo(() => {
    if (!state.latestGuessCanonical) return null;

    return {
      id: state.guessSequence,
      canonical: state.latestGuessCanonical,
      feature: state.countriesByCanonical[state.latestGuessCanonical] ?? null
    };
  }, [state.countriesByCanonical, state.guessSequence, state.latestGuessCanonical]);

  const startGame = () => {
    setStatusByCanonical({});
    setQuery('');
    setState((current) => ({
      ...current,
      gamePhase: 'running',
      guessedCount: 0,
      missedCount: 0,
      secondsElapsed: 0,
      suggestions: [],
      summary: null,
      latestGuessCanonical: null,
      latestGuessContinent: null,
      guessSequence: 0,
      continentGuessed: Object.fromEntries(
        Object.keys(current.continentTotals).map((continent) => [continent, 0])
      )
    }));
  };

  const applyGuess = (rawGuess) => {
    if (state.gamePhase !== 'running') return;

    const canonical = resolveCanonicalGuess(rawGuess);
    if (!canonical) return;

    if (statusByCanonical[canonical] === 'guessed') return;

    const feature = state.countriesByCanonical[canonical];
    const continent = feature?.properties?.continent ?? 'Other';

    setStatusByCanonical((current) => ({
      ...current,
      [canonical]: 'guessed'
    }));

    setState((current) => {
      const guessedCount = current.guessedCount + 1;
      const nextContinent = {
        ...current.continentGuessed,
        [continent]: (current.continentGuessed[continent] ?? 0) + 1
      };

      if (guessedCount >= current.totalCountries) {
        return {
          ...current,
          gamePhase: 'complete',
          guessedCount,
          continentGuessed: nextContinent,
          latestGuessCanonical: canonical,
          latestGuessContinent: continent,
          guessSequence: current.guessSequence + 1,
          summary: {
            guessedCount,
            missedCount: 0,
            accuracy: 100
          },
          suggestions: []
        };
      }

      return {
        ...current,
        guessedCount,
        continentGuessed: nextContinent,
        latestGuessCanonical: canonical,
        latestGuessContinent: continent,
        guessSequence: current.guessSequence + 1,
        suggestions: []
      };
    });
  };

  const giveUp = () => {
    if (state.gamePhase !== 'running') return;

    const nextStatus = {};
    Object.keys(state.countriesByCanonical).forEach((canonical) => {
      nextStatus[canonical] = statusByCanonical[canonical] === 'guessed' ? 'guessed' : 'missed';
    });
    setStatusByCanonical(nextStatus);

    const guessedCount = state.guessedCount;
    const missedCount = state.totalCountries - guessedCount;
    const accuracy = state.totalCountries
      ? Math.round((guessedCount / state.totalCountries) * 100)
      : 0;

    setState((current) => ({
      ...current,
      gamePhase: 'complete',
      missedCount,
      latestGuessCanonical: null,
      summary: {
        guessedCount,
        missedCount,
        accuracy
      },
      suggestions: []
    }));
  };

  const updateQuery = (value) => {
    setQuery(value);

    if (state.gamePhase !== 'running') {
      setState((current) => ({ ...current, suggestions: [] }));
      return;
    }

    const normalized = normalizeName(value);
    if (!normalized) {
      setState((current) => ({ ...current, suggestions: [] }));
      return;
    }

    const exactCanonical = resolveCanonicalGuess(value);
    if (exactCanonical && shouldAutoSubmit(value)) {
      if (statusByCanonical[exactCanonical] === 'guessed') {
        setQuery('');
        setState((current) => ({
          ...current,
          suggestions: []
        }));
        return;
      }

      applyGuess(value);
      setQuery('');
      setState((current) => ({
        ...current,
        suggestions: []
      }));
      return;
    }

    const countries = Object.entries(state.countriesByCanonical)
      .map(([canonical, feature]) => ({
        canonical,
        name: feature.properties.country_name
      }))
      .filter((country) => normalizeName(country.name).startsWith(normalized))
      .filter((country) => statusByCanonical[country.canonical] !== 'guessed')
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 3);

    setState((current) => ({
      ...current,
      suggestions: countries
    }));
  };

  const submitQuery = () => {
    applyGuess(query);
    setQuery('');
    setState((current) => ({
      ...current,
      suggestions: []
    }));
  };

  const guessFromSuggestion = (name) => {
    applyGuess(name);
    setQuery('');
    setState((current) => ({
      ...current,
      suggestions: []
    }));
  };

  const restart = () => {
    setStatusByCanonical({});
    setQuery('');
    setState((current) => ({
      ...current,
      gamePhase: 'idle',
      guessedCount: 0,
      missedCount: 0,
      secondsElapsed: 0,
      summary: null,
      suggestions: [],
      latestGuessCanonical: null,
      latestGuessContinent: null,
      guessSequence: 0,
      continentGuessed: Object.fromEntries(
        Object.keys(current.continentTotals).map((continent) => [continent, 0])
      )
    }));
  };

  return {
    ...state,
    query,
    displayGeoJson,
    displayLabelPoints,
    guessedCountriesByContinent,
    continentCountryRows,
    focusTarget,
    startGame,
    updateQuery,
    submitQuery,
    guessFromSuggestion,
    giveUp,
    restart
  };
}


