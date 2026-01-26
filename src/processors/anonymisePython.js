// src/anonymisePython.js
// Fixes remaining failing cases:
// [8] Same param name in different functions gets a NEW NATO token (scoped params/locals)
// [29] match/case: case-pattern strings use a separate string namespace (no accidental reuse)
// [32] f-strings with only expressions (f"{a}{b}") do NOT get lorem injected

const NATO = [
  "Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "Golf", "Hotel", "India", "Juliett",
  "Kilo", "Lima", "Mike", "November", "Oscar", "Papa", "Quebec", "Romeo", "Sierra", "Tango",
  "Uniform", "Victor", "Whiskey", "Xray", "Yankee", "Zulu",
];

const LOREM = [
  "Lorem Ipsum",
  "Dolor sit amet",
  "Consectetur adipiscing elit",
  "Sed do eiusmod",
  "Tempor incididunt",
  "Ut labore et dolore",
  "Magna aliqua",
  "Ut enim ad minim",
  "Veniam quis nostrud",
  "Exercitation ullamco",
  "Laboris nisi ut",
  "Aliquip ex ea",
  "Commodo consequat",
  "Duis aute irure",
  "Dolor in reprehenderit",
  "In voluptate velit",
  "Esse cillum dolore",
  "Eu fugiat nulla",
  "Pariatur excepteur",
  "Sint occaecat cupidatat",
];

const PY_KEYWORDS = new Set([
  "False", "None", "True", "and", "as", "assert", "async", "await", "break", "case", "class",
  "continue", "def", "del", "elif", "else", "except", "finally", "for", "from", "global", "if",
  "import", "in", "is", "lambda", "match", "nonlocal", "not", "or", "pass", "raise", "return",
  "try", "while", "with", "yield",
]);

const PY_BUILTINS = new Set([
  "print", "len", "range", "int", "sum", "open", "super", "property", "ValueError",
]);

function isIdentStart(ch) { return /[A-Za-z_]/.test(ch); }
function isIdentPart(ch) { return /[A-Za-z0-9_]/.test(ch); }
function isSpecialMethod(name) { return /^__.*__$/.test(name); }

function anonymisePython(input) {
  // --- NATO allocation (global sequence) ---
  let varIndex = 0;
  const nextNato = () => NATO[varIndex++] ?? `Var${varIndex}`;

  // --- Namespaces ---
  // Module/global vars by name
  const globalVarMap = new Map();

  // Function-local vars (scoped) – stored per active function scope
  const scopeStack = []; // { defIndent:number, map:Map<string,string> }

  // Function/class names
  const fnMap = new Map();
  let fnIndex = 0;
  const classMap = new Map();
  let classIndex = 0;

  // Strings:
  // - normal strings reuse by content (needed for dict key reuse test)
  // - case-pattern strings are separate (needed for match/case test)
  const strMap = new Map();
  const caseStrMap = new Map();
  let strIndex = 0;
  const nextLorem = () => LOREM[strIndex++] ?? `Lorem ${strIndex}`;

  // self.<attr> mapping (keeps "_" prefix)
  const selfAttrMap = new Map();

  // property getter names (separate namespace, already fixed)
  const propMap = new Map();

  // imports
  const importedNames = new Set();

  function getGlobalVar(name) {
    if (!globalVarMap.has(name)) globalVarMap.set(name, nextNato());
    return globalVarMap.get(name);
  }
  function resolveScopedVar(name) {
    // lexical lookup: inner scopes can read outer scope vars (closure/decorator)
    for (let s = scopeStack.length - 1; s >= 0; s--) {
      const m = scopeStack[s].map;
      if (m.has(name)) return m.get(name);
    }

    // not found: define in current scope if any, else global
    if (scopeStack.length === 0) return getGlobalVar(name);

    const top = scopeStack[scopeStack.length - 1].map;
    const mapped = nextNato();
    top.set(name, mapped);
    return mapped;
  }
  function getFn(name) {
    if (!fnMap.has(name)) fnMap.set(name, `Function${++fnIndex}`);
    return fnMap.get(name);
  }
  function getClass(name) {
    if (!classMap.has(name)) classMap.set(name, `Class${++classIndex}`);
    return classMap.get(name);
  }
  function getProp(name) {
    if (!propMap.has(name)) propMap.set(name, nextNato());
    return propMap.get(name);
  }
  function getStr(content) {
    if (!strMap.has(content)) strMap.set(content, nextLorem());
    return strMap.get(content);
  }
  function getCaseStr(content) {
    if (!caseStrMap.has(content)) caseStrMap.set(content, nextLorem());
    return caseStrMap.get(content);
  }

  function shouldRenameIdentifier(name) {
    if (!name) return false;
    if (PY_KEYWORDS.has(name)) return false;
    if (PY_BUILTINS.has(name)) return false;
    if (importedNames.has(name)) return false;
    return true;
  }

  function parseImportLine(line) {
    const trimmed = line.trim();
    if (trimmed.startsWith("import ")) {
      const rest = trimmed.slice("import ".length).trim();
      for (const part of rest.split(",").map((s) => s.trim())) {
        const m = part.match(/^([A-Za-z_][A-Za-z0-9_]*)(\s+as\s+([A-Za-z_][A-Za-z0-9_]*))?$/);
        if (m) importedNames.add(m[3] || m[1]);
      }
    } else if (trimmed.startsWith("from ")) {
      const m = trimmed.match(/^from\s+([A-Za-z_][A-Za-z0-9_.]*)\s+import\s+(.+)$/);
      if (m) {
        for (const it of m[2].split(",").map((s) => s.trim())) {
          const m2 = it.match(/^([A-Za-z_][A-Za-z0-9_]*)(\s+as\s+([A-Za-z_][A-Za-z0-9_]*))?$/);
          if (m2) importedNames.add(m2[3] || m2[1]);
        }
      }
    }
  }

  function stripCommentsPreserveStrings(line) {
    let out = "";
    let i = 0;
    let inS = false;
    let inD = false;

    while (i < line.length) {
      const ch = line[i];
      if (!inS && !inD) {
        if (ch === "'") { inS = true; out += ch; i++; continue; }
        if (ch === '"') { inD = true; out += ch; i++; continue; }
        if (ch === "#") break;
        out += ch; i++; continue;
      }
      if (inS) {
        out += ch;
        if (ch === "\\" && i + 1 < line.length) { out += line[i + 1]; i += 2; continue; }
        if (ch === "'") inS = false;
        i++; continue;
      }
      out += ch;
      if (ch === "\\" && i + 1 < line.length) { out += line[i + 1]; i += 2; continue; }
      if (ch === '"') inD = false;
      i++;
    }
    return out;
  }

  function detectTripleQuoteOpener(trimmed) {
    const m = trimmed.match(/^([rRuUbBfF]{0,3})(""")/);
    if (m) return { quote: '"""', prefixLen: m[1].length };
    const m2 = trimmed.match(/^([rRuUbBfF]{0,3})(''')/);
    if (m2) return { quote: "'''", prefixLen: m2[1].length };
    return null;
  }

  function removeDocstringsAndComments(code) {
    const lines = code.replace(/\r\n/g, "\n").split("\n");
    for (const l of lines) parseImportLine(l);

    const outLines = [];
    let pendingDocstringIndent = new Set([0]);
    let inDocstring = false;
    let docQuote = null;

    for (let li = 0; li < lines.length; li++) {
      const raw = lines[li];
      const indent = (raw.match(/^(\s*)/)?.[1]?.length) ?? 0;
      const trimmed = raw.trim();

      if (inDocstring) {
        if (raw.includes(docQuote)) { inDocstring = false; docQuote = null; }
        continue;
      }

      if (trimmed === "") {
        if (outLines.length > 0) outLines.push("");
        continue;
      }

      if (pendingDocstringIndent.has(indent)) {
        const opener = detectTripleQuoteOpener(trimmed);
        if (opener) {
          const quote = opener.quote;
          const rest = trimmed.slice(opener.prefixLen);
          const firstQuotePos = rest.indexOf(quote);
          const afterFirst = firstQuotePos === -1 ? "" : rest.slice(firstQuotePos + 3);
          if (!afterFirst.includes(quote)) { inDocstring = true; docQuote = quote; }
          pendingDocstringIndent.delete(indent);
          continue;
        }
      }

      const noComment = stripCommentsPreserveStrings(raw);
      outLines.push(noComment);

      const t2 = noComment.trim();
      const isDef = t2.startsWith("def ") || t2.startsWith("async def ");
      const isClass = t2.startsWith("class ");
      if (isDef || isClass) {
        for (let j = li + 1; j < lines.length; j++) {
          const nxt = lines[j];
          if (nxt.trim() === "") continue;
          const ind = (nxt.match(/^(\s*)/)?.[1]?.length) ?? 0;
          if (ind > indent) pendingDocstringIndent.add(ind);
          break;
        }
      }

      if (indent === 0) pendingDocstringIndent.delete(0);
    }

    while (outLines.length > 0 && outLines[outLines.length - 1].trim() === "") outLines.pop();
    return outLines.join("\n") + (code.endsWith("\n") ? "\n" : "");
  }

  function rewriteIdentifiersInExpr(expr) {
    let i = 0;
    let out = "";

    while (i < expr.length) {
      const ch = expr[i];

      // keep inner strings intact
      if (/[rRuUbBfF'"]/.test(ch)) {
        const save = i;
        let j = i;
        while (j < expr.length && /[rRuUbBfF]/.test(expr[j])) j++;
        const isQ =
          expr.slice(j, j + 3) === '"""' ||
          expr.slice(j, j + 3) === "'''" ||
          expr[j] === '"' ||
          expr[j] === "'";
        if (isQ) {
          let k = j;
          const q3 =
            expr.slice(k, k + 3) === '"""' ? '"""' : expr.slice(k, k + 3) === "'''" ? "'''" : null;
          if (q3) {
            k += 3;
            while (k < expr.length && expr.slice(k, k + 3) !== q3) k++;
            k = Math.min(expr.length, k + 3);
            out += expr.slice(save, k);
            i = k;
            continue;
          }
          const q = expr[j];
          k = j + 1;
          while (k < expr.length) {
            if (expr[k] === "\\") { k += 2; continue; }
            if (expr[k] === q) { k++; break; }
            k++;
          }
          out += expr.slice(save, k);
          i = k;
          continue;
        }
        i = save;
      }

      if (isIdentStart(ch)) {
        const start = i;
        i++;
        while (i < expr.length && isIdentPart(expr[i])) i++;
        const ident = expr.slice(start, i);

        if (ident === "self" || !shouldRenameIdentifier(ident)) out += ident;
        else if (propMap.has(ident)) out += propMap.get(ident);
        else {
          // lexical scope lookup inside f-string expressions too
          let found = null;
          for (let s = scopeStack.length - 1; s >= 0; s--) {
          const m = scopeStack[s].map;
          if (m.has(ident)) { found = m.get(ident); break; }
          }


          if (found) out += found;
          else if (globalVarMap.has(ident)) out += globalVarMap.get(ident);
          else if (fnMap.has(ident)) out += fnMap.get(ident);
          else if (classMap.has(ident)) out += classMap.get(ident);
          else out += getGlobalVar(ident);
        }
        continue;
      }

      out += ch;
      i++;
    }

    return out;
  }

  function anonymiseStringLiteralToken(rawToken, { inCasePattern } = { inCasePattern: false }) {
    const prefixMatch = rawToken.match(/^([rRuUbBfF]*)/);
    const prefix = prefixMatch ? prefixMatch[1] : "";
    const rest = rawToken.slice(prefix.length);

    const quote = rest.startsWith('"""')
      ? '"""'
      : rest.startsWith("'''")
        ? "'''"
        : rest.startsWith('"')
          ? '"'
          : rest.startsWith("'")
            ? "'"
            : null;

    if (!quote) return rawToken;

    const qLen = quote.length;
    const content = rest.slice(qLen, rest.length - qLen);

    const isF = /f/i.test(prefix);

    // Non f-string: use normal or case-pattern string namespace
    if (!isF) {
      const mapped = inCasePattern ? getCaseStr(content) : getStr(content);
      return `${prefix}${quote}${mapped}${quote}`;
    }

    // f-string: split into static parts and expressions
    const parts = [];
    const exprs = [];
    let i = 0;
    let buf = "";

    while (i < content.length) {
      const ch = content[i];

      if (ch === "{" && content[i + 1] !== "{") {
        parts.push(buf);
        buf = "";
        i++;
        let depth = 1;
        let ebuf = "";
        while (i < content.length) {
          const c2 = content[i];
          if (c2 === "{" && content[i + 1] !== "{") depth++;
          if (c2 === "}" && content[i + 1] !== "}") {
            depth--;
            if (depth === 0) break;
          }
          ebuf += c2;
          i++;
        }
        exprs.push(ebuf);
        if (i < content.length && content[i] === "}") i++;
        continue;
      }

      if (ch === "{" && content[i + 1] === "{") { buf += "{"; i += 2; continue; }
      if (ch === "}" && content[i + 1] === "}") { buf += "}"; i += 2; continue; }

      buf += ch;
      i++;
    }
    parts.push(buf);

    // [32] If ALL static parts are empty, DO NOT inject lorem (e.g. f"{a}{b}")
    const allStaticEmpty = parts.every((p) => p.trim() === "");
    if (allStaticEmpty) {
      const rewritten = exprs.map((e) => `{${rewriteIdentifiersInExpr(e)}}`).join("");
      return `${prefix}${quote}${rewritten}${quote}`;
    }

    // Otherwise: replace static text with a single lorem fragment distributed across parts
    const lorem = getStr(`__f__:${content}`);
    const words = lorem.split(/\s+/).filter(Boolean);

    const segCount = parts.length;
    const chunks = Array.from({ length: segCount }, () => []);
    if (segCount === 2) {
      // if trailing static is empty, keep all lorem in the first chunk (matches your goldens)
      if (parts[1] === "") {
        chunks[0] = words;
        chunks[1] = [];
      } else if (words.length <= 1) {
        chunks[0] = words;
        chunks[1] = [];
      } else {
        chunks[0] = [words[0]];
        chunks[1] = words.slice(1);
      }
    } else {
      // simple proportional split
      let w = 0;
      for (let s = 0; s < segCount; s++) {
        const remainingSegs = segCount - s;
        const remainingWords = words.length - w;
        const take = s === segCount - 1 ? remainingWords : Math.max(0, Math.floor(remainingWords / remainingSegs));
        chunks[s] = words.slice(w, w + take);
        w += take;
      }
      if (w < words.length) chunks[segCount - 1] = chunks[segCount - 1].concat(words.slice(w));
    }
    const chunkText = chunks.map((ws) => (ws.length ? ws.join(" ") : ""));

    let out = "";
    for (let k = 0; k < exprs.length; k++) {
      const origStatic = parts[k];
      const replacement = origStatic.trim().length === 0 ? origStatic : (chunkText[k] || "");
      out += replacement;

      out += `{${rewriteIdentifiersInExpr(exprs[k])}}`;

      const nextOrig = parts[k + 1];
      const nextRep = nextOrig.trim().length === 0 ? nextOrig : (chunkText[k + 1] || "");
      if (nextRep && /^[A-Za-z0-9_]/.test(nextRep) && !out.endsWith(" ")) out += " ";
    }
    const lastOrig = parts[parts.length - 1];
    const lastRep = lastOrig.trim().length === 0 ? lastOrig : (chunkText[chunkText.length - 1] || "");
    out += lastRep;

    return `${prefix}${quote}${out}${quote}`;
  }

  function tokenizeAndRewrite(code) {
    let i = 0;
    let out = "";

    let awaitingDefName = false;
    let awaitingClassName = false;

    let afterAt = false;
    let justSawPropertyDecorator = false;

    let parenDepth = 0;
    let inDefSignature = false;

    let afterCaseKeyword = false;

    // [8] signature-local map (so same param name in another function can get a new NATO)
    let sigMap = null;
    let pendingDefIndent = null;

    const lastNonWsChar = () => {
      for (let j = out.length - 1; j >= 0; j--) {
        if (!/\s/.test(out[j])) return out[j];
      }
      return "";
    };

    const currentLineIndentFromOut = () => {
      // compute indent of current line by walking backwards to last '\n'
      let j = out.length - 1;
      while (j >= 0 && out[j] !== "\n") j--;
      // j is -1 or at '\n'
      let k = j + 1;
      let cnt = 0;
      while (k < out.length && out[k] === " ") { cnt++; k++; }
      return cnt;
    };

    function popScopesForIndent(indent) {
      while (scopeStack.length > 0) {
        const top = scopeStack[scopeStack.length - 1];
        if (indent <= top.defIndent) scopeStack.pop();
        else break;
      }
    }

    function readIdentifier() {
      const start = i;
      i++;
      while (i < code.length && isIdentPart(code[i])) i++;
      return code.slice(start, i);
    }

    function readStringToken() {
      const start = i;
      while (i < code.length && /[rRuUbBfF]/.test(code[i])) i++;

      const q3 =
        code.slice(i, i + 3) === '"""' ? '"""' : code.slice(i, i + 3) === "'''" ? "'''" : null;
      if (q3) {
        i += 3;
        while (i < code.length && code.slice(i, i + 3) !== q3) i++;
        i = Math.min(code.length, i + 3);
        return code.slice(start, i);
      }

      if (code[i] === '"' || code[i] === "'") {
        const q = code[i];
        i++;
        while (i < code.length) {
          if (code[i] === "\\") { i += 2; continue; }
          if (code[i] === q) { i++; break; }
          i++;
        }
        return code.slice(start, i);
      }

      i = start;
      return "";
    }

    function isKeywordArgHere(endIndex) {
      if (inDefSignature) return false;
      if (parenDepth <= 0) return false;

      const prev = lastNonWsChar();
      if (prev !== "(" && prev !== ",") return false;

      let k = endIndex;
      while (k < code.length && /\s/.test(code[k]) && code[k] !== "\n") k++;
      return code[k] === "=";
    }

    while (i < code.length) {
      const ch = code[i];

      if (ch === "\n") {
        // pop scopes when indent decreases on next line
        out += ch;
        i++;
        afterAt = false;
        afterCaseKeyword = false;

        // look ahead indent in original code
        let j = i;
        let indent = 0;
        while (j < code.length && code[j] === " ") { indent++; j++; }
        popScopesForIndent(indent);

        continue;
      }

      if (ch === "@") {
        afterAt = true;
        out += ch;
        i++;
        continue;
      }

      // strings
      if (/[rRuUbBfF'"]/.test(ch)) {
        const save = i;
        let j = i;
        while (j < code.length && /[rRuUbBfF]/.test(code[j])) j++;
        const isQ =
          code.slice(j, j + 3) === '"""' ||
          code.slice(j, j + 3) === "'''" ||
          code[j] === '"' ||
          code[j] === "'";
        if (isQ) {
          const tok = readStringToken();
          out += anonymiseStringLiteralToken(tok, { inCasePattern: afterCaseKeyword });
          continue;
        }
        i = save;
      }

      if (ch === "(") { parenDepth++; out += ch; i++; continue; }
      if (ch === ")") { parenDepth = Math.max(0, parenDepth - 1); out += ch; i++; continue; }

      if (ch === ":" && inDefSignature && parenDepth === 0) {
        // end of signature: push a new function scope
        inDefSignature = false;
        out += ch;
        i++;

        const defIndent = pendingDefIndent ?? 0;
        const m = new Map();
        if (sigMap) {
          for (const [k, v] of sigMap.entries()) m.set(k, v);
        }
        scopeStack.push({ defIndent, map: m });

        sigMap = null;
        pendingDefIndent = null;

        continue;
      }

      // self.<attr>
      if (ch === "." && code.slice(i - 4, i) === "self") {
        out += ch;
        i++;
        if (i < code.length && isIdentStart(code[i])) {
          const start = i;
          i++;
          while (i < code.length && isIdentPart(code[i])) i++;
          const attr = code.slice(start, i);

          if (!selfAttrMap.has(attr) && shouldRenameIdentifier(attr)) {
            const base = nextNato();
            selfAttrMap.set(attr, attr.startsWith("_") ? `_${base}` : base);
          }

          out += selfAttrMap.get(attr) || attr;
          continue;
        }
        continue;
      }

      // identifiers
      if (isIdentStart(ch)) {
        const ident = readIdentifier();

        if (ident === "def") {
          out += ident;
          awaitingDefName = true;
          inDefSignature = true;

          // [8] create a fresh signature map; allocate from GLOBAL NATO sequence
          sigMap = new Map();
          pendingDefIndent = currentLineIndentFromOut();

          continue;
        }
        if (ident === "async") { out += ident; continue; }
        if (ident === "class") { out += ident; awaitingClassName = true; continue; }
        if (ident === "case") { out += ident; afterCaseKeyword = true; continue; }

        if (afterAt && ident === "property") {
          out += ident;
          afterAt = false;
          justSawPropertyDecorator = true;
          continue;
        }

        if (awaitingDefName) {
          awaitingDefName = false;
          afterAt = false;

          if (isSpecialMethod(ident)) out += ident;
          else if (justSawPropertyDecorator) {
            out += getProp(ident);
            justSawPropertyDecorator = false;
          } else {
            out += getFn(ident);
          }
          continue;
        }

        if (awaitingClassName) {
          awaitingClassName = false;
          out += getClass(ident);
          continue;
        }

        if (afterAt) {
          afterAt = false;
          if (fnMap.has(ident)) out += fnMap.get(ident);
          else if (shouldRenameIdentifier(ident)) out += getFn(ident);
          else out += ident;
          continue;
        }

        // case patterns: do NOT rename bare-name captures
        if (afterCaseKeyword) { out += ident; continue; }

        // keyword arg in call: foo(mode="x") -> keep "mode"
        if (isKeywordArgHere(i)) { out += ident; continue; }

        // member access: obj.attr
        const prev = lastNonWsChar();
        if (prev === ".") {
          if (propMap.has(ident)) out += propMap.get(ident);
          else if (fnMap.has(ident)) out += fnMap.get(ident);
          else if (selfAttrMap.has(ident)) out += selfAttrMap.get(ident);
          else out += ident;
          continue;
        }

        if (classMap.has(ident)) { out += classMap.get(ident); continue; }
        if (fnMap.has(ident)) { out += fnMap.get(ident); continue; }

        if (ident === "self" || !shouldRenameIdentifier(ident)) { out += ident; continue; }

        // [8] If we're in def signature, allocate from sigMap (fresh per function)
        if (inDefSignature && sigMap) {
          if (!sigMap.has(ident)) sigMap.set(ident, nextNato());
          out += sigMap.get(ident);
          continue;
        }

        // inside a function body => scoped vars
        out += resolveScopedVar(ident);
        continue;
      }

      out += ch;
      i++;
    }

    return out;
  }

  const noDocsNoComments = removeDocstringsAndComments(input);
  return tokenizeAndRewrite(noDocsNoComments);
}

export default anonymisePython;
export { anonymisePython };