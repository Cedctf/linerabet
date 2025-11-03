import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Home, Games, Profile } from './pages';
import "./App.css";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/games" element={<Games />} />
        <Route path="/profile" element={<Profile />} />
      </Routes>
    </Router>
  );
}

export default App;