import { useState } from 'react';

export default function ActionButton({ onClick, children, message = 'Anonymised!' }) {
  const [status, setStatus] = useState(false);

  const handleClick = () => {
    onClick();
    setStatus(true);
    setTimeout(() => setStatus(false), 1500);
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button className="anonymise-button" onClick={handleClick}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
        {children}
      </button>
      {status && (
        <div className="tooltip">
          {message}
        </div>
      )}
    </div>
  );
}
