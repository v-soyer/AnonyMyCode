import { useState } from 'react';
import HighlightedEditor from '../components/HighlightedEditor';
import CopyButton from '../components/CopyButton';
import ActionButton from '../components/ActionButton';
import { anonymisePython } from '../processors/anonymisePython';

export default function PythonPage() {
const [inputCode, setInputCode] = useState(`def greet(name):
  message = f"Hello, {name}!"
  print(message)

greet("Alice")`);

  const [outputCode, setOutputCode] = useState('');

  const handleAnonymise = () => {
    const result = anonymisePython(inputCode);
    setOutputCode(result);
  };

  return (
    <div className="page">
      <h2>Python Code Anonymiser</h2>

      <HighlightedEditor
        label="Original Code"
        code={inputCode}
        setCode={setInputCode}
        language="python"
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
        language="python"
        readOnly
      />

      <CopyButton content={outputCode} />
    </div>
  );
}
