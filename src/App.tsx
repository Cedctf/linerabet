import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Home, Blackjack, Baccarat, Roulette, Games } from './pages';
import RouletteBlueprintDemo from './pages/roulette-blueprint';
import Layout from './components/Layout';
import "./App.css";

import { GameProvider } from './context/GameContext';

function App() {
  return (
    <GameProvider>
      <Router>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/games" element={<Games />} />
            <Route path="/blackjack" element={<Blackjack />} />
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

