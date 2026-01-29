import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import JavaScriptPage from './pages/JavaScriptPage';
import PythonPage from './pages/PythonPage';
import SQLPage from './pages/SQLPage';
import './App.css';

function App() {
  return (
    <Router>
      <header className="top-bar">
        <div className="logo">
          <div className="logo-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 18l6-6-6-6" />
              <path d="M8 6l-6 6 6 6" />
            </svg>
          </div>
          AnonyMyCode
        </div>
        <nav className="nav-links">
          <NavLink to="/" end>JavaScript</NavLink>
          <NavLink to="/python">Python</NavLink>
          <NavLink to="/sql">SQL</NavLink>
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<JavaScriptPage />} />
          <Route path="/python" element={<PythonPage />} />
          <Route path="/sql" element={<SQLPage />} />
        </Routes>
      </main>
    </Router>
  );
}

export default App;
