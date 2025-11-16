import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Home, Blackjack, Baccarat, Roulette } from './pages';
import "./App.css";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/blackjack" element={<Blackjack />} />
        <Route path="/baccarat" element={<Baccarat />} />
        <Route path="/roulette" element={<Roulette />} />
      </Routes>
    </Router>
  );
}

export default App;
