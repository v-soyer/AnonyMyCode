import { useState } from 'react';

export default function ActionButton({ onClick, children, message = 'Anonymised !' }) {
  const [status, setStatus] = useState(false);

  const handleClick = () => {
    onClick();
    setStatus(true);
    setTimeout(() => setStatus(false), 500);
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button className="anonymise-button" onClick={handleClick}>
        {children}
      </button>
      {status && (
        <div style={{
          position: 'absolute',
          top: '-1.8rem',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#374151',
          color: '#fff',
          padding: '4px 8px',
          fontSize: '0.75rem',
          borderRadius: '4px',
          whiteSpace: 'nowrap',
          pointerEvents: 'none'
        }}>
          {message}
        </div>
      )}
    </div>
  );
}
