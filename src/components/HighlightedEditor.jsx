import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs';
import 'prismjs/themes/prism-tomorrow.css';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-sql';

export default function HighlightedEditor({
  code,
  setCode,
  language,
  readOnly = false,
  label,
  charLimit = null,
  showCounter = false,
  isInvalid = false
}) {
  const grammar = {
    javascript: languages.javascript,
    python: languages.python,
    sql: languages.sql,
  };

  const wrapperClasses = `editor-wrapper${isInvalid ? ' invalid' : ''}`;

  return (
    <div className="editor-section">
      {label && <h3>{label}</h3>}
      <div className={wrapperClasses}>
        <Editor
          value={code}
          onValueChange={readOnly ? () => {} : setCode}
          highlight={code => highlight(code, grammar[language])}
          padding={16}
          className="prism-editor"
          style={{
            backgroundColor: 'transparent',
            color: '#e4e4e7',
            fontSize: 14,
            minHeight: '220px',
            fontFamily: '"JetBrains Mono", "Roboto Mono", monospace',
            lineHeight: 1.7,
          }}
          textareaClassName="editor-textarea"
        />
        {showCounter && charLimit && (
          <div className={`char-counter${code.length > charLimit ? ' invalid' : ''}`}>
            {code.length} / {charLimit}
          </div>
        )}
      </div>
    </div>
  );
}
