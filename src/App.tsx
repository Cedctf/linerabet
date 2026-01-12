import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Home, Blackjack, Blackjack2, Baccarat, Baccarat2, Roulette, Games } from './pages';
import RouletteBlueprintDemo from './pages/roulette-blueprint';
import Layout from './components/Layout';
import "./App.css";

import { GameProvider } from './context/GameContext';

function App() {
  return (
    <GameProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/games" element={<Games />} />
          <Route path="/baccarat2" element={<Baccarat2 />} />
          <Route element={<Layout />}>
            <Route path="/blackjack" element={<Blackjack />} />
            <Route path="/blackjack2" element={<Blackjack2 />} />
            <Route path="/baccarat" element={<Baccarat />} />
            <Route path="/roulette" element={<Roulette />} />
            <Route path="/roulette-blueprint" element={<RouletteBlueprintDemo />} />
          </Route>
        </Routes>
      </Router>
    </GameProvider>
  );
}

export default App;

