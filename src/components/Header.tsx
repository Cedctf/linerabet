import { DynamicWidget } from "@dynamic-labs/sdk-react-core";
import { useDarkMode } from '../lib/useDarkMode';

function Header() {
  const { isDarkMode } = useDarkMode();

  return (
    <div className="header">
      <img className="logo" src={isDarkMode ? "/logo-light.png" : "/logo-dark.png"} alt="dynamic" />
      <div className="header-buttons">
        <DynamicWidget />
      </div>
    </div>
  );
}

export default Header;

