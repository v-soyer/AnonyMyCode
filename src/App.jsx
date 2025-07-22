import React, { useState } from 'react';
import './styles.css';

function App() {
  const [inputCode, setInputCode] = useState('');
  const [outputCode, setOutputCode] = useState('');

  function anonymiserCodePython(code) {
    let funcMap = new Map();
    let paramMap = new Map();
    let varMap = new Map();
    let classMap = new Map();

    const natoAlphabet = [
      "Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "Golf",
      "Hotel", "India", "Juliett", "Kilo", "Lima", "Mike", "November",
      "Oscar", "Papa", "Quebec", "Romeo", "Sierra", "Tango", "Uniform",
      "Victor", "Whiskey", "Xray", "Yankee", "Zulu"
    ];

    let funcCounter = 1;
    let varCounter = 1;
    let paramCounter = 1;
    let classCounter = 1;

    // Remplacer les chaînes par du NATO
    code = code.replace(/"([^"]*)"/g, () => {
      const replacement = natoAlphabet[Math.floor(Math.random() * natoAlphabet.length)];
      return `"${replacement}"`;
    });

    // Remplacer les définitions de classes
    code = code.replace(/class\s+([a-zA-Z_][a-zA-Z0-9_]*)/g, (match, className) => {
      if (!classMap.has(className)) {
        classMap.set(className, `Class${classCounter++}`);
      }
      return `class ${classMap.get(className)}`;
    });

    // Remplacer les définitions de fonctions et paramètres
    code = code.replace(/def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)/g, (match, funcName, params) => {
      if (!funcMap.has(funcName)) {
        funcMap.set(funcName, `Func${funcCounter++}`);
      }
      const newFunc = funcMap.get(funcName);

      const paramList = params.split(',').map(p => p.trim()).filter(p => p !== "");
      const newParams = paramList.map(p => {
        const name = p.split('=')[0].trim();
        if (!paramMap.has(name)) {
          paramMap.set(name, `Param${paramCounter++}`);
        }
        return paramMap.get(name);
      });

      return `def ${newFunc}(${newParams.join(', ')})`;
    });

    // Remplacer les affectations de variables
    code = code.replace(/(\b[a-zA-Z_][a-zA-Z0-9_]*\b)\s*=/g, (match, varName) => {
      if (!varMap.has(varName) && !funcMap.has(varName) && !paramMap.has(varName) && !classMap.has(varName)) {
        varMap.set(varName, `Var${varCounter++}`);
      }
      return `${varMap.get(varName) || varName} =`;
    });

    // Appliquer les remplacements
    funcMap.forEach((newName, oldName) => {
      const regex = new RegExp(`\\b${oldName}\\b`, 'g');
      code = code.replace(regex, newName);
    });
    paramMap.forEach((newName, oldName) => {
      const regex = new RegExp(`\\b${oldName}\\b`, 'g');
      code = code.replace(regex, newName);
    });
    varMap.forEach((newName, oldName) => {
      const regex = new RegExp(`\\b${oldName}\\b`, 'g');
      code = code.replace(regex, newName);
    });
    classMap.forEach((newName, oldName) => {
      const regex = new RegExp(`\\b${oldName}\\b`, 'g');
      code = code.replace(regex, newName);
    });

    return code;
  }

    function highlightPython(code) {
    // Échappe le HTML du texte brut (entièrement)
    const escapeHTML = (text) =>
      text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // On échappe le texte en entier AVANT tout
    let escaped = escapeHTML(code);

    // Ensuite, on applique les balises HTML sur le texte échappé
    escaped = escaped
      .replace(/\b(def|return|print|if|else|for|in|while|import|from|as|class|with|try|except|finally|pass|None|True|False)\b/g,
        '<span class="keyword">$1</span>')
      .replace(/(&quot;.*?&quot;)/g, '<span class="string">$1</span>') // parfois le navigateur transforme déjà " en &quot;
      .replace(/\b(Func\d+)\b/g, '<span class="function">$1</span>')
      .replace(/\b(Param\d+)\b/g, '<span class="param">$1</span>')
      .replace(/\b(Var\d+)\b/g, '<span class="var">$1</span>')
      .replace(/\b(Class\d+)\b/g, '<span class="class">$1</span>');


    return escaped;
  }

  return (
    <div className="page-wrapper">
      <div className="header">AnonyMyCode</div>

      <div className="app-container">
        <h1 className="app-title">Anonymisation de Code Python</h1>

        <div className="input-container">
          <label htmlFor="inputCode" className="input-label">Code Python Original :</label>
          <textarea
            id="inputCode"
            value={inputCode}
            onChange={(e) => setInputCode(e.target.value)}
            placeholder="Collez votre code Python ici..."
            className="input-textarea"
          />
        </div>

        <button
          onClick={() => setOutputCode(anonymiserCodePython(inputCode))}
          className="anonymize-button"
        >
          Anonymiser le code
        </button>

        <div className="output-container">
          <label htmlFor="outputCode" className="output-label">Code Python Anonymisé :</label>
          <div className="output-code" dangerouslySetInnerHTML={{ __html: highlightPython(outputCode) }}></div>
        </div>
      </div>
    </div>
  );
}

export default App;
