import { useNavigate } from 'react-router-dom';
import './Home.css';

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="home-container">
      <img
        src="/Landing.png"
        alt="Background"
        className="home-background"
      />

      {/* Overlay Content */}
      <div className="home-overlay">
        <h1 className="home-title">LineraBet</h1>
        <button
          className="play-now-btn"
          onClick={() => navigate('/game')}
        >
          Play Now
        </button>
      </div>
    </div>
  );
}
