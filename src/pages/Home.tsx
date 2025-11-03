import { useDarkMode } from '../lib/useDarkMode';
import DynamicMethods from '../components/Methods';
import Header from '../components/Header';
import "../App.css";

function Home() {
  const { isDarkMode } = useDarkMode();

  return (
    <div className={`container ${isDarkMode ? 'dark' : 'light'}`}>
      <Header />

      <div className="modal">
        <DynamicMethods isDarkMode={isDarkMode} />
      </div>

      <div className="footer">
        <div className="footer-text">Made with 💙 by dynamic</div>
        <img 
          className="footer-image" 
          src={isDarkMode ? "/image-dark.png" : "/image-light.png"} 
          alt="dynamic"
        />
      </div>
    </div>
  );
}

export default Home;

