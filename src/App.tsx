import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Home, Blackjack, Baccarat } from './pages';
import "./App.css";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/blackjack" element={<Blackjack />} />
        <Route path="/baccarat" element={<Baccarat />} />
      </Routes>
    </Router>
  );
}

export default App;
