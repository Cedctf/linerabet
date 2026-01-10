import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Home.css';

export default function Home() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const handlePlayNow = () => {
    if (videoRef.current) {
      setIsPlaying(true);
      videoRef.current.play();
    }
  };

  const handleVideoEnd = () => {
    navigate('/game');
  };

  return (
    <div className="home-container">
      <video
        ref={videoRef}
        src="/Landing.mp4"
        className="home-background"
        muted
        playsInline
        onEnded={handleVideoEnd}
      />

      {/* Overlay Content - hide when video is playing */}
      {!isPlaying && (
        <div className="home-overlay">
          <h1 className="home-title">LineraBet</h1>
          <button
            className="play-now-btn"
            onClick={handlePlayNow}
          >
            Play Now
          </button>
        </div>
      )}
    </div>
  );
}
