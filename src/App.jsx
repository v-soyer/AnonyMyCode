import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import JavaScriptPage from './pages/JavaScriptPage';
import PythonPage from './pages/PythonPage';
import SQLPage from './pages/SQLPage';
import './App.css';

function App() {
  return (
    <Router>
      <header className="top-bar">
        <div className="logo">AnonyMyCode</div>
        <nav className="nav-links">
          <NavLink to="/" end>JavaScript</NavLink>
          <NavLink to="/python">Python</NavLink>
          <NavLink to="/sql">SQL</NavLink>
        </nav>
      </header>
      <main className="page">
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
