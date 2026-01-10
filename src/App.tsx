import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Home, Blackjack, Baccarat, Roulette, Games } from './pages';
import Layout from './components/Layout';
import "./App.css";

import { GameProvider } from './context/GameContext';

function App() {
  return (
    <GameProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route element={<Layout />}>
            <Route path="/games" element={<Games />} />
            <Route path="/blackjack" element={<Blackjack />} />
            <Route path="/baccarat" element={<Baccarat />} />
            <Route path="/roulette" element={<Roulette />} />
          </Route>
        </Routes>
      </Router>
    </GameProvider>
  );
}

export default App;
