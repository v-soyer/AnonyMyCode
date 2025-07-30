export function anonymisePython(code) {
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
