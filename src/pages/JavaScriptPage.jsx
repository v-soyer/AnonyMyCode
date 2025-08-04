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
      <h2>JavaScript Code Anonymiser</h2>

      <HighlightedEditor
        label="Original Code"
        code={inputCode}
        setCode={setInputCode}
        language="javascript"
        charLimit={CHAR_LIMIT}
        showCounter
        isInvalid={inputCode.length > CHAR_LIMIT}
      />

      <ActionButton onClick={handleAnonymise}>
        Anonymise
      </ActionButton>
      {error && (
        <p style={{ color: '#f87171', marginTop: '0.5rem' }}>{error}</p>
      )}
      <br />
      <br />
      <HighlightedEditor
        label="Anonymised Code"
        code={outputCode}
        setCode={() => {}}
        language="javascript"
        readOnly
      />

      <CopyButton content={outputCode} />
    </div>
  );
}
