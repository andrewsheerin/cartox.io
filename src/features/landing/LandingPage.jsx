export default function LandingPage({ games, onStartGame }) {
  return (
    <div className="pageShell">
      <header className="landingHeader">
        <p className="eyebrow">Geography Games</p>
        <h1 className="brandTitle">Cartox</h1>
        <p className="landingSubtext">
          Pick a challenge, zoom around the world, and level up your geography trivia.
        </p>
      </header>

      <main className="landingGrid" aria-label="Game selection">
        {games.map((game) => {
          const isLive = game.status === 'live';

          return (
            <article key={game.id} className={`gameTile tileAccent-${game.accent}`}>
              <div className="gameTileMeta">
                <span className={`statusPill status-${game.status}`}>
                  {isLive ? 'Play now' : 'Coming soon'}
                </span>
              </div>

              <h2>{game.title}</h2>
              <p>{game.subtitle}</p>

              <button
                type="button"
                className="tileButton landingStartButton"
                disabled={!isLive}
                onClick={() => isLive && onStartGame(game.id)}
              >
                {isLive ? 'Start game' : 'Locked'}
              </button>
            </article>
          );
        })}
      </main>
    </div>
  );
}

