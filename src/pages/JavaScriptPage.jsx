import { useState } from 'react';
import HighlightedEditor from '../components/HighlightedEditor';
import CopyButton from '../components/CopyButton';
import ActionButton from '../components/ActionButton';
import { anonymiseJS } from '../processors/anonymiseJS';

export default function JavaScriptPage() {
const [inputCode, setInputCode] = useState(`function greet(name) {
  const message = \`Hello, \${name}!\`;
  console.log(message);
}

greet('Alice');`);

  const [outputCode, setOutputCode] = useState('');

  const handleAnonymise = () => {
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
      />

      <ActionButton onClick={handleAnonymise}>
        Anonymise
      </ActionButton>
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
