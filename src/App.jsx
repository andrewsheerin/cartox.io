import { useMemo, useState } from 'react';
import LandingPage from './features/landing/LandingPage';
import WorldGamePage from './features/worldGame/WorldGamePage';
import { gameCatalog } from './features/games/gameCatalog';

export default function App() {
  const [activeGameId, setActiveGameId] = useState(null);

  const activeGame = useMemo(
    () => gameCatalog.find((game) => game.id === activeGameId) ?? null,
    [activeGameId]
  );

  if (!activeGame) {
    return <LandingPage games={gameCatalog} onStartGame={setActiveGameId} />;
  }

  if (activeGame.id === 'worldCountries') {
    return <WorldGamePage onExit={() => setActiveGameId(null)} />;
  }

  return <LandingPage games={gameCatalog} onStartGame={setActiveGameId} />;
}

