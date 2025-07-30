import { useState } from 'react';

export default function CopyButton({ content }) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button onClick={copyToClipboard} onMouseLeave={() => setCopied(false)}>
        Copy to Clipboard
      </button>
      {copied && (
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
          Copied !
        </div>
      )}
    </div>
  );
}
