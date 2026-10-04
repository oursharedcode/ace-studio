import AceStudio from "./AceStudio";
import AdRail from "./AdRail";

// Layout: studio fills the left two thirds, the ad + visitor-map rail the
// right third. On narrow screens the rail drops below the studio.
export default function App() {
  return (
    <div className="app-shell">
      <style>{`
        .app-shell {
          display: flex;
          width: 100%;
          height: 100vh;
          overflow: hidden;
          background: #0A0E1A;
        }
        .app-main {
          flex: 0 0 66.6667%;
          min-width: 0;
          height: 100%;
          overflow: hidden;
        }
        @media (max-width: 900px) {
          .app-shell { flex-direction: column; height: auto; overflow: visible; }
          .app-main { flex: none; width: 100%; height: 100vh; }
          .app-shell > aside { flex: none !important; width: 100%; height: 480px; border-left: none !important; border-top: 1px solid #252D42; }
        }
      `}</style>
      <div className="app-main">
        <AceStudio />
      </div>
      <AdRail />
    </div>
  );
}
