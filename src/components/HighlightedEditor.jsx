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

  const borderStyle = isInvalid
    ? '2px solid #f87171' // red
    : '1px solid #333';

  return (
    <div style={{ marginBottom: '1.5rem', position: 'relative' }}>
      {label && <h3 style={{ marginBottom: '0.5rem', color: '#ccc' }}>{label}</h3>}
      <Editor
        value={code}
        onValueChange={readOnly ? () => {} : setCode}
        highlight={code => highlight(code, grammar[language])}
        padding={12}
        style={{
          backgroundColor: '#1e1e1e',
          color: '#f8f8f2',
          borderRadius: '6px',
          fontSize: 14,
          minHeight: '200px',
          border: borderStyle,
          fontFamily: '"Roboto Mono", monospace'
        }}
      />
      {showCounter && (
        <div style={{
          position: 'absolute',
          bottom: '6px',
          right: '12px',
          fontSize: '0.7rem',
          color: code.length > (charLimit ?? Infinity) ? '#f87171' : '#9ca3af'
        }}>
          {code.length}/{charLimit}
        </div>
      )}
    </div>
  );
}
