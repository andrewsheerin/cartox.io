import { useEffect, useState } from 'react';
import { formatTime } from './gameUtils';
import useWorldCountryGame from './useWorldCountryGame';
import WorldMapView from './WorldMapView';

const howToPlayCopy =
  'See how fast you can name the countries of the World! Type country names to reveal them on the globe.';

function ControlsPanelContent({
  showCountryOutlines,
  onToggleCountryOutlines,
  showSpellingHints,
  onToggleSpellingHints
}) {
  return (
    <>
      <label className="settingsRetroToggle">
        <input
          type="checkbox"
          checked={showCountryOutlines}
          onChange={(event) => onToggleCountryOutlines(event.target.checked)}
        />
        <span className="settingsRetroToggleTrack" aria-hidden="true">
          <span className="settingsRetroToggleThumb" />
        </span>
        <span className="settingsRetroToggleText">
          <strong>Country outlines</strong>
        </span>
      </label>

      <label className="settingsRetroToggle">
        <input
          type="checkbox"
          checked={showSpellingHints}
          onChange={(event) => onToggleSpellingHints(event.target.checked)}
        />
        <span className="settingsRetroToggleTrack" aria-hidden="true">
          <span className="settingsRetroToggleThumb" />
        </span>
        <span className="settingsRetroToggleText">
          <strong>Spelling hints</strong>
        </span>
      </label>
    </>
  );
}

function WorldGameSettings({
  showCountryOutlines,
  onToggleCountryOutlines,
  showSpellingHints,
  onToggleSpellingHints
}) {
  return (
    <div className="settingsColumn">
      <aside
        className="settingsPanel"
        aria-label="Game settings"
      >
        <div className="settingsPanelHeader">
          <h2 className="accentSectionTitle">Controls</h2>
        </div>

        <ControlsPanelContent
          showCountryOutlines={showCountryOutlines}
          onToggleCountryOutlines={onToggleCountryOutlines}
          showSpellingHints={showSpellingHints}
          onToggleSpellingHints={onToggleSpellingHints}
        />
      </aside>
    </div>
  );
}

function GuessInput({
  query,
  suggestions,
  showSpellingHints,
  gamePhase,
  onQueryChange,
  onSubmit,
  onSuggestionSelect
}) {
  return (
    <div className="guessSection">
      {gamePhase === 'running' && (
        <form
          className="guessPanel"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <label htmlFor="countryGuess" className="srOnly">
            Country guess
          </label>
          <input
            id="countryGuess"
            autoComplete="off"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Type a country"
          />
          <button type="submit">Guess</button>
          {showSpellingHints && suggestions.length > 0 && (
            <div className="suggestionList" role="listbox" aria-label="Country suggestions">
              {suggestions.map((item) => (
                <button
                  key={item.canonical}
                  type="button"
                  onClick={() => onSuggestionSelect(item.name)}
                  className="suggestionItem"
                >
                  {item.name}
                </button>
              ))}
            </div>
          )}
        </form>
      )}
    </div>
  );
}

function DesktopContinentCards({
  continentTotals,
  continentGuessed,
  continentCountryRows,
  activeContinent,
  onSelect
}) {
  return (
    <div className="continentCardGrid">
      {Object.entries(continentTotals)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([continent, total]) => {
          const countryRows = continentCountryRows[continent] ?? [];
          const isExpanded = activeContinent === continent;

          return (
            <article
              key={continent}
              className={`continentCard ${isExpanded ? 'continentCardExpanded' : ''}`}
            >
              <div className="continentCardHeader">
                <span className="continentCardTitleBlock">
                  <strong>{continent}</strong>
                </span>
              </div>

              <div className="continentCardFooter">
                <small className="continentCardCount">{continentGuessed[continent] ?? 0} / {total}</small>
                <button
                  type="button"
                  className="continentCardToggle"
                  onClick={() => onSelect(isExpanded ? null : continent)}
                  aria-expanded={isExpanded}
                  aria-label={isExpanded ? `Collapse ${continent}` : `Expand ${continent}`}
                >
                  <span className="continentChevron">{isExpanded ? '-' : '+'}</span>
                </button>
              </div>

              {isExpanded && (
                <div className="continentCardBody">
                  <div className="continentTable" role="table" aria-label={`${continent} countries`}>
                    {countryRows.map((country) => (
                      <div key={country.canonical} className="continentTableRow" role="row">
                        <span
                          className={`continentTableCell ${country.guessed ? 'continentTableCellGuessed' : 'continentTableCellBlank'}`}
                          role="cell"
                        >
                          {country.guessed ? country.name : '\u00A0'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </article>
          );
        })}
    </div>
  );
}

function MobileContinentCards({ continentTotals, continentGuessed, activeContinent, onSelect }) {
  return (
    <div className="continentTileRow">
      {Object.entries(continentTotals)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([continent, total]) => {
          const isActive = activeContinent === continent;

          return (
            <button
              type="button"
              key={continent}
              className={`continentTile ${isActive ? 'continentTileActive' : ''}`}
              onClick={() => onSelect(isActive ? null : continent)}
              aria-pressed={isActive}
              aria-label={`${continent}: ${continentGuessed[continent] ?? 0} of ${total}`}
            >
              <span className="continentTileIcon" aria-hidden="true">+</span>
              <span className="continentTileCount">{continentGuessed[continent] ?? 0} / {total}</span>
              <span className="continentTileName">{continent}</span>
            </button>
          );
        })}
    </div>
  );
}

function MobileContinentOverlay({ activeContinent, continentCountryRows, onClose }) {
  const countries = activeContinent ? (continentCountryRows[activeContinent] ?? []) : [];

  return (
    <div className={`mobileContinentOverlay ${activeContinent ? 'mobileContinentOverlayOpen' : ''}`}>
      <section
        className="mobileContinentSheet"
        role="dialog"
        aria-modal="false"
        aria-label={activeContinent ? `${activeContinent} countries` : 'Continent countries'}
      >
        <header className="mobileContinentSheetHeader">
          <h3>{activeContinent ?? 'Continent'}</h3>
          <button type="button" className="mobileContinentCloseButton" onClick={onClose} aria-label="Close continent list">
            x
          </button>
        </header>

        <ul className="mobileContinentCountryList" aria-label="Countries">
          {countries.map((country) => (
            <li
              key={country.canonical}
              className={`mobileContinentCountryItem ${country.guessed ? 'mobileContinentCountryItemGuessed' : ''}`}
              aria-label={country.guessed ? country.name : 'Unguessed country'}
            >
              {country.guessed ? country.name : '\u00A0'}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default function WorldGamePage({ onExit }) {
  const game = useWorldCountryGame();
  const [activeContinent, setActiveContinent] = useState(null);
  const [showCountryOutlines, setShowCountryOutlines] = useState(true);
  const [showSpellingHints, setShowSpellingHints] = useState(true);
  const [activeMobilePopover, setActiveMobilePopover] = useState(null);

  useEffect(() => {
    if (game.gamePhase === 'idle') {
      setActiveContinent(null);
    }
  }, [game.gamePhase]);

  useEffect(() => {
    if (game.gamePhase === 'idle' || game.gamePhase === 'complete') {
      setActiveMobilePopover(null);
    }
  }, [game.gamePhase]);

  return (
    <div className="gameShell">
      <header className="gameHeader">
        <div className="gameHeaderLeft">
          <button type="button" className="backButton homeNavButton" onClick={onExit} aria-label="Home">
            <svg className="homeButtonIcon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path
                fill="currentColor"
                d="M12 3 2.5 11h2V21h6v-6h3v6h6V11h2L12 3Z"
              />
            </svg>
          </button>

          <div className="gameTitleCluster">
            <div className="gameHeadingBlock">
              <p className="gameBrandMark">Cartox</p>
              <h1 className="gameTitle">World Countries Sprint</h1>
            </div>

            <p className="desktopHowToPlayText">{howToPlayCopy}</p>
          </div>
        </div>

        <div className="gameHeaderRight">
          <div className="liveStats">
            {game.gamePhase === 'running' && (
              <button type="button" className="dangerButton liveDangerButton" onClick={game.giveUp}>
                Give up
              </button>
            )}
            <span className="liveStatTimer">{formatTime(game.secondsElapsed)}</span>
            <span className="liveStatCount">{game.guessedCount} / {game.totalCountries}</span>
            <div className="mobileControlTrigger">
              <button
                type="button"
                className={`howToPlayToggleButton ${activeMobilePopover === 'howToPlay' ? 'mobileControlButtonActive' : ''}`}
                onClick={() => setActiveMobilePopover((current) => (current === 'howToPlay' ? null : 'howToPlay'))}
                aria-expanded={activeMobilePopover === 'howToPlay'}
                aria-label="Toggle how to play"
              >
                <span className="mobileControlIcon" aria-hidden="true">💡</span>
              </button>
              <div
                className={`mobileAttachedPopover mobileAttachedPopover--howToPlay ${activeMobilePopover === 'howToPlay' ? 'mobileAttachedPopoverOpen' : ''}`}
              >
                <p className="mobileHowToPlayText">{howToPlayCopy}</p>
              </div>
            </div>
            <div className="mobileControlTrigger">
              <button
                type="button"
                className={`settingsToggleButton ${activeMobilePopover === 'controls' ? 'mobileControlButtonActive' : ''}`}
                onClick={() => setActiveMobilePopover((current) => (current === 'controls' ? null : 'controls'))}
                aria-expanded={activeMobilePopover === 'controls'}
                aria-label="Toggle controls"
              >
                <span className="mobileControlIcon" aria-hidden="true">⚙</span>
              </button>
              <div
                className={`mobileAttachedPopover mobileAttachedPopover--controls ${activeMobilePopover === 'controls' ? 'mobileAttachedPopoverOpen' : ''}`}
              >
                <ControlsPanelContent
                  showCountryOutlines={showCountryOutlines}
                  onToggleCountryOutlines={setShowCountryOutlines}
                  showSpellingHints={showSpellingHints}
                  onToggleSpellingHints={setShowSpellingHints}
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="gameBoard">
        <div className="gameMainColumn">
          <div className="topControlRow">
            <div className="controlPanel">
              {game.loading && <p>Loading countries...</p>}
              {game.error && <p className="errorText">{game.error}</p>}

              <p className="accentSectionTitle sectionLabel">List the countries</p>

              <div className="buttonRow">
                {game.gamePhase === 'idle' && (
                  <button type="button" className="ctaButton gamePrimaryButton" onClick={game.startGame}>
                    Begin game
                  </button>
                )}

                {game.gamePhase === 'complete' && (
                  <button type="button" className="ctaButton" onClick={game.restart}>
                    Play again
                  </button>
                )}
              </div>

              <GuessInput
                query={game.query}
                suggestions={game.suggestions}
                showSpellingHints={showSpellingHints}
                gamePhase={game.gamePhase}
                onQueryChange={game.updateQuery}
                onSubmit={game.submitQuery}
                onSuggestionSelect={game.guessFromSuggestion}
              />

            </div>

            <WorldGameSettings
              showCountryOutlines={showCountryOutlines}
              onToggleCountryOutlines={setShowCountryOutlines}
              showSpellingHints={showSpellingHints}
              onToggleSpellingHints={setShowSpellingHints}
            />
          </div>

          <div className="mapStage">
            {game.displayGeoJson && game.displayLabelPoints ? (
              <WorldMapView
                countriesData={game.displayGeoJson}
                labelData={game.displayLabelPoints}
                focusTarget={game.focusTarget}
                gamePhase={game.gamePhase}
                showCountryOutlines={showCountryOutlines}
              />
            ) : (
              <div className="mapFallback">Loading map...</div>
            )}

            <MobileContinentOverlay
              activeContinent={activeContinent}
              continentCountryRows={game.continentCountryRows}
              onClose={() => setActiveContinent(null)}
            />
          </div>
        </div>

        <aside className="continentPanel">
          <div className="continentPanelHeader">
            <h2 className="accentSectionTitle">Continents</h2>
          </div>

          <div className="desktopContinentCards">
            <DesktopContinentCards
              continentTotals={game.continentTotals}
              continentGuessed={game.continentGuessed}
              continentCountryRows={game.continentCountryRows}
              activeContinent={activeContinent}
              onSelect={setActiveContinent}
            />
          </div>

          <div className="mobileContinentCards">
            <MobileContinentCards
              continentTotals={game.continentTotals}
              continentGuessed={game.continentGuessed}
              activeContinent={activeContinent}
              onSelect={setActiveContinent}
            />
          </div>
        </aside>
      </section>
    </div>
  );
}



