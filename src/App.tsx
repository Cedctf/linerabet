import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Home, Blackjack, Baccarat, Baccarat2, Roulette, Games } from './pages';
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
          <Route element={<Layout />}>
            <Route path="/blackjack" element={<Blackjack />} />
            <Route path="/baccarat" element={<Baccarat />} />
            <Route path="/baccarat2" element={<Baccarat2 />} />
            <Route path="/roulette" element={<Roulette />} />
          </Route>
        </Routes>
      </Router>
    </GameProvider>
  );
}

export default App;
