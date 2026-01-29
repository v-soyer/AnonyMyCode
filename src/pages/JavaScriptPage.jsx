import { useState } from 'react';
import HighlightedEditor from '../components/HighlightedEditor';
import CopyButton from '../components/CopyButton';
import ActionButton from '../components/ActionButton';
import { anonymiseJS } from '../processors/anonymiseJS';

const CHAR_LIMIT = 3000;

export default function JavaScriptPage() {
  const [inputCode, setInputCode] = useState(`function greet(name) {
  const message = \`Hello, \${name}!\`;
  console.log(message);
}

greet('Alice');`);

  const [outputCode, setOutputCode] = useState('');
  const [error, setError] = useState('');

  const handleAnonymise = () => {
    if (inputCode.length > CHAR_LIMIT) {
      setError(`Code exceeds ${CHAR_LIMIT} characters.`);
      return;
    }
    setError('');
    const result = anonymiseJS(inputCode);
    setOutputCode(result);
  };

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
        <h2>JavaScript Anonymiser</h2>
        <span className="language-badge javascript">JS</span>
      </div>
      <p className="page-description">
        Paste your JavaScript code below to anonymise variable names, function names, and identifiers.
      </p>

      <HighlightedEditor
        label="Original Code"
        code={inputCode}
        setCode={setInputCode}
        language="javascript"
        charLimit={CHAR_LIMIT}
        showCounter
        isInvalid={inputCode.length > CHAR_LIMIT}
      />

      <div className="button-group">
        <ActionButton onClick={handleAnonymise}>
          Anonymise Code
        </ActionButton>
        {error && (
          <p className="error-message">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {error}
          </p>
        )}
      </div>

      <HighlightedEditor
        label="Anonymised Output"
        code={outputCode}
        setCode={() => {}}
        language="javascript"
        readOnly
      />

      <CopyButton content={outputCode} />
    </div>
  );
}
