import { useState } from 'react';
import HighlightedEditor from '../components/HighlightedEditor';
import CopyButton from '../components/CopyButton';
import ActionButton from '../components/ActionButton';
import { anonymiseSQL } from '../processors/anonymiseSQL';

export default function SQLPage() {
const [inputCode, setInputCode] = useState(`SELECT first_name, last_name
FROM users
WHERE created_at > '2023-01-01';`);

  const [outputCode, setOutputCode] = useState('');

  const handleAnonymise = () => {
    const result = anonymiseSQL(inputCode);
    setOutputCode(result);
  };

  return (
    <div className="page">
      <h2>SQL Requests Anonymiser</h2>

      <HighlightedEditor
        label="Original Code"
        code={inputCode}
        setCode={setInputCode}
        language="sql"
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
        language="sql"
        readOnly
      />

      <CopyButton content={outputCode} />
    </div>
  );
}
