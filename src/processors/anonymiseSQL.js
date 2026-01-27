const natoAlphabet = [
  "Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "Golf",
  "Hotel", "India", "Juliett", "Kilo", "Lima", "Mike", "November",
  "Oscar", "Papa", "Quebec", "Romeo", "Sierra", "Tango", "Uniform",
  "Victor", "Whiskey", "Xray", "Yankee", "Zulu",
];

// NOTE: don't include USER / ROLE here; they can be real identifiers in tests
const SQL_KEYWORDS = new Set([
  "SELECT", "FROM", "WHERE", "GROUP", "BY", "ORDER", "HAVING", "LIMIT", "OFFSET", "JOIN", "INNER",
  "LEFT", "RIGHT", "FULL", "OUTER", "ON", "USING", "AS", "DISTINCT", "UNION", "ALL", "EXCEPT", "INTERSECT",
  "AND", "OR", "NOT", "IN", "IS", "NULL", "BETWEEN", "LIKE", "ILIKE", "EXISTS", "ANY", "SOME", "INSERT", "INTO",
  "VALUES", "UPDATE", "SET", "DELETE", "CREATE", "TABLE", "DATABASE", "ALTER", "DROP", "RENAME", "TRUNCATE", "INT",
  "INTEGER", "BIGINT", "SMALLINT", "TINYINT", "DECIMAL", "NUMERIC", "FLOAT", "REAL", "CHAR", "VARCHAR", "TEXT", "DATE",
  "TIME", "TIMESTAMP", "BOOLEAN", "COUNT", "SUM", "AVG", "MIN", "MAX", "NOW", "COALESCE", "CAST", "CONVERT", "BEGIN",
  "COMMIT", "ROLLBACK", "SAVEPOINT", "TRANSACTION", "GRANT", "REVOKE", "WITH", "CASE", "WHEN", "THEN", "ELSE", "END",
  "DEFAULT", "PRIMARY", "KEY", "FOREIGN", "REFERENCES", "CHECK", "INDEX", "VIEW", "IF", "ASC", "DESC", "ESCAPE",
  "OVER", "PARTITION", "WINDOW", "RANK", "DENSE_RANK", "ROW_NUMBER", "ADD", "COLUMN", "RETURNING",
]);

const AFTER_REL_KEYWORDS = [
"ON","USING","WHERE","JOIN","LEFT","RIGHT","FULL","INNER","OUTER",
"GROUP","ORDER","HAVING","LIMIT","OFFSET","UNION","EXCEPT","INTERSECT",
"RETURNING","VALUES","SET"
];

const AFTER_REL_NEG = AFTER_REL_KEYWORDS.join("|"); // used inside regex

function isKeyword(word) {
  return SQL_KEYWORDS.has(String(word).toUpperCase());
}

function isAnonRelationChain(raw, relationAnonSet) {
  const parts = splitQualified(raw);
  if (parts.length === 0) return false;
  return parts.every((p) => {
    const { value } = unwrapIdent(p);
    return relationAnonSet.has(value) || isNatoBaseWord(value);
  });
}

function isPlaceholder(word) {
  return (
    word === "?" ||
    /^\$\d+$/.test(word) ||
    /^:[A-Za-z_]\w*$/.test(word) ||
    /^@[A-Za-z_]\w*$/.test(word)
  );
}

function isNumber(word) {
  return /^(\d+(\.\d+)?|\.\d+)$/.test(word);
}

function colLetter(idx) {
  const base = idx % 26;
  const suffix = Math.floor(idx / 26);
  const letter = String.fromCharCode(65 + base); // A-Z
  return suffix === 0 ? letter : `${letter}${suffix}`;
}

function isNatoBaseWord(w) {
  const base = String(w || "").replace(/\d+$/, "");
  if (!base) return false;
  return natoAlphabet.some((n) => n.toLowerCase() === base.toLowerCase());
}

const escapeRegExp = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Split qualified identifiers on dots, but not inside quotes/backticks/brackets
function splitQualified(raw) {
  const parts = [];
  let cur = "";
  let mode = null; // '"', '`', '['
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];

    if (!mode) {
      if (ch === '"') mode = '"';
      else if (ch === "`") mode = "`";
      else if (ch === "[") mode = "[";
      else if (ch === ".") {
        parts.push(cur);
        cur = "";
        continue;
      }
    } else {
      if (mode === '"' && ch === '"') mode = null;
      else if (mode === "`" && ch === "`") mode = null;
      else if (mode === "[" && ch === "]") mode = null;
    }
    cur += ch;
  }
  parts.push(cur);
  return parts.filter((p) => p.length > 0);
}

function unwrapIdent(part) {
  if (part.startsWith('"') && part.endsWith('"')) return { value: part.slice(1, -1), wrap: '"' };
  if (part.startsWith("`") && part.endsWith("`")) return { value: part.slice(1, -1), wrap: "`" };
  if (part.startsWith("[") && part.endsWith("]")) return { value: part.slice(1, -1), wrap: "[" };
  return { value: part, wrap: null };
}

function rewrapIdent(value, wrap) {
  if (wrap === '"') return `"${value}"`;
  if (wrap === "`") return `\`${value}\``;
  if (wrap === "[") return `[${value}]`;
  return value;
}

// SQL unquoted identifiers are generally case-insensitive.
// We normalize keys for unquoted identifiers to avoid "id" vs "ID" diverging.
function keyForIdent(value, wrap) {
  if (!value) return value;
  return wrap ? value : String(value).toLowerCase();
}

export function anonymiseSQL(sql) {
  // reset state PER CALL
  const relationMap = new Map(); // db/schema/table/cte -> NATO
  const relationAnonSet = new Set(); // NATO outputs so we never treat them as columns
  const aliasMap = new Map(); // real alias -> tX
  const columnMap = new Map(); // (scoped) column key -> A/B/C...
  const colAliasMap = new Map(); // real col alias -> cX

  let relCounter = 0;
  let aliasCounter = 1;
  let colCounter = 0;
  let colAliasCounter = 1;

  // implicit aliases: when a relation/cte name is used like "u.id" without explicit alias
  const implicitAliasKeys = new Set(); // keys (lowercased)
  // derived-table aliases
  const derivedAliasSet = new Set(); // anon aliases like t1/t2 that came from derived tables

  // bind anonymised alias -> anonymised relation (so CTE/table outputs are scoped consistently)
  const aliasToRel = new Map(); // anonAlias -> anonRel

  // Track CTE body ranges so we can scope unqualified identifiers inside each CTE
  const cteRanges = []; // { start, end, scope: "Alpha" }

  const mapRelationPart = (part) => {
    const { value, wrap } = unwrapIdent(part);
    if (!value) return part;

    const k = keyForIdent(value, wrap);

    if (!relationMap.has(k)) {
      const anon =
        natoAlphabet[relCounter % natoAlphabet.length] +
        (relCounter >= natoAlphabet.length ? Math.floor(relCounter / natoAlphabet.length) : "");
      relationMap.set(k, anon);
      relationAnonSet.add(anon);
      relCounter++;
    }
    return rewrapIdent(relationMap.get(k), wrap);
  };

  const mapQualifiedRelation = (rawIdent) => {
    const parts = splitQualified(rawIdent);
    return parts.map(mapRelationPart).join(".");
  };

  const mapAlias = (alias) => {
    if (!alias || isKeyword(alias)) return alias;
    const k = keyForIdent(alias, null);
    if (!aliasMap.has(k)) aliasMap.set(k, `t${aliasCounter++}`);
    return aliasMap.get(k);
  };

  // ✅ Column mapping; allow derived-table alias to reuse the unscoped mapping, but keep other scopes isolated.
  const mapColumn = (token, scopeKey = null) => {
    const { value, wrap } = unwrapIdent(token);
    if (!value || isKeyword(value) || isNumber(value) || isPlaceholder(value)) return token;

    // already-anonymised column (A, B, C, A1...)
    if (/^[A-Z]\d*$/i.test(value)) return token;

    const baseKey = keyForIdent(value, wrap);
    const scopedKey = scopeKey ? `${scopeKey}::${baseKey}` : baseKey;

    // derived-table alias can reuse unscoped mapping (keeps test #25 behavior)
    if (scopeKey && derivedAliasSet.has(scopeKey) && !columnMap.has(scopedKey) && columnMap.has(baseKey)) {
      columnMap.set(scopedKey, columnMap.get(baseKey));
    }

    if (!columnMap.has(scopedKey)) columnMap.set(scopedKey, colLetter(colCounter++));
    return rewrapIdent(columnMap.get(scopedKey), wrap);
  };

  // ✅ RESTORED (your runtime error)
  const mapColAlias = (alias) => {
    if (!alias || isKeyword(alias)) return alias;
    const k = keyForIdent(alias, null);
    if (!colAliasMap.has(k)) colAliasMap.set(k, `c${colAliasCounter++}`);
    return colAliasMap.get(k);
  };

  // 1) normalize input
  let s = String(sql ?? "").replace(/\r\n?/g, "\n");

  // 2) protect ONLY single-quoted strings (SQL identifiers may be double-quoted)
  const strings = [];
  s = s.replace(/'(?:''|[^'])*'/g, (m) => {
    const idx = strings.push(m) - 1;
    return `@@STR${idx}@@`;
  });

  // 3) remove comments
  s = s.replace(/--[^\n]*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

  const shouldSkipWord = (w) => {
    if (!w) return true;
    if (isKeyword(w)) return true;
    if (isNumber(w)) return true;
    if (isPlaceholder(w)) return true;
    if (/^t\d+$/i.test(w)) return true;
    if (/^c\d+$/i.test(w)) return true;
    if (/^[A-Z]\d*$/i.test(w)) return true; // already mapped column
    if (relationAnonSet.has(w)) return true;
    if (isNatoBaseWord(w)) return true;

    // don't treat already-known relations/CTEs as columns
    const k = keyForIdent(w, null);
    if (relationMap.has(k)) return true;

    return false;
  };

  // --- CTE pre-scan to enforce mapping order and record body ranges ---
  const prescanCtes = () => {
    const upper = s.toUpperCase();
    const withIdx = upper.indexOf("WITH");
    if (withIdx === -1) return;

    let i = withIdx + 4;

    const skipWs = () => {
      while (i < s.length && /\s/.test(s[i])) i++;
    };

    const readIdent = () => {
      skipWs();
      const start = i;

      if (s[i] === '"' || s[i] === "`" || s[i] === "[") {
        const open = s[i];
        const close = open === "[" ? "]" : open;
        i++;
        while (i < s.length && s[i] !== close) i++;
        if (i < s.length) i++;
        return s.slice(start, i);
      }

      while (i < s.length && /[A-Za-z0-9_]/.test(s[i])) i++;
      return s.slice(start, i);
    };

    const findMatchingParen = (fromIdx) => {
      let depth = 0;
      let mode = null; // "'" or '"' or "`" or "["

      for (let j = fromIdx; j < s.length; j++) {
        const ch = s[j];

        if (!mode && ch === "'") mode = "'";
        else if (mode === "'" && ch === "'") mode = null;

        if (!mode) {
          if (ch === '"') mode = '"';
          else if (ch === "`") mode = "`";
          else if (ch === "[") mode = "[";
          else if (ch === "(") depth++;
          else if (ch === ")") {
            depth--;
            if (depth === 0) return j;
          }
        } else {
          if (mode === '"' && ch === '"') mode = null;
          else if (mode === "`" && ch === "`") mode = null;
          else if (mode === "[" && ch === "]") mode = null;
        }
      }
      return -1;
    };

    const preallocRelationsAndAliasesInBody = (body) => {
      const relPatternLocal = /[A-Za-z0-9_`"\[\]\.]+/;
      const rx = new RegExp(
        `\\b(FROM|JOIN|UPDATE|INSERT\\s+INTO|DELETE\\s+FROM)\\s+(${relPatternLocal.source})(?:\\s+(?:AS\\s+)?([A-Za-z_]\\w*))?`,
        "gi"
      );
      let m;
      while ((m = rx.exec(body))) {
        const rel = m[2];
        const alias = m[3];
        if (rel && !rel.startsWith("(")) mapQualifiedRelation(rel);
        if (alias && !isKeyword(alias)) mapAlias(alias);
      }
    };

    // ✅ Preallocate OUTPUT columns from the CTE SELECT list, scoped to the CTE anon name
    // so later references (Alpha.t1.A etc) stay consistent.
    const preallocCteOutputColumns = (body, cteAnonName) => {
      const m = body.match(/\bSELECT\b([\s\S]*?)\bFROM\b/i);
      const selectList = m ? m[1] : "";

      const tokens =
        selectList.match(/"(?:[^"]+)"|`(?:[^`]+)`|\[(?:[^\]]+)\]|\b[A-Za-z_]\w*\b/g) || [];

      let prevUpper = "";
      let localIdx = 0;

      for (const tok of tokens) {
        const { value, wrap } = unwrapIdent(tok);
        const upperTok = String(value).toUpperCase();

        if (prevUpper === "AS") {
          prevUpper = upperTok;
          continue;
        }

        if (shouldSkipWord(value)) {
          prevUpper = upperTok;
          continue;
        }

        const baseKey = keyForIdent(value, wrap);
        const scopedKey = `${cteAnonName}::${baseKey}`;

        if (!columnMap.has(scopedKey)) {
          columnMap.set(scopedKey, colLetter(localIdx++)); // A,B,C... per CTE outputs
        }

        prevUpper = upperTok;
      }
    };

    skipWs();

    while (i < s.length) {
      const name = readIdent();
      if (!name) break;

      const cteAnon = mapQualifiedRelation(name);

      skipWs();
      if (s.slice(i, i + 2).toUpperCase() === "AS") i += 2;
      skipWs();

      if (s[i] !== "(") {
        const idx = s.indexOf("(", i);
        if (idx === -1) break;
        i = idx;
      }

      const openParen = i;
      const closeParen = findMatchingParen(openParen);
      if (closeParen === -1) break;

      // record the CTE body range (exclusive parens)
      cteRanges.push({ start: openParen + 1, end: closeParen, scope: cteAnon });

      const body = s.slice(openParen + 1, closeParen);
      preallocRelationsAndAliasesInBody(body);
      preallocCteOutputColumns(body, cteAnon);

      i = closeParen + 1;
      skipWs();

      if (s[i] === ",") {
        i++;
        skipWs();
        continue;
      }
      break;
    }
  };

  prescanCtes();

  // 4) anonymise CTE names in the WITH header
  s = s.replace(/\bWITH\s+([A-Za-z_][\w]*)\s+AS\s*\(/gi, (m, cte) =>
    m.replace(cte, mapQualifiedRelation(cte))
  );
  s = s.replace(/,\s*([A-Za-z_][\w]*)\s+AS\s*\(/g, (m, cte) =>
    m.replace(cte, mapQualifiedRelation(cte))
  );

  const relPattern = /[A-Za-z0-9_`"\[\]\.]+/;

  const safeAliasOrNull = (alias) => {
    if (!alias) return null;
    if (isKeyword(alias)) return null;
    return mapAlias(alias);
  };

  // --- Derived-table pre-scan (allocate inner columns UN-SCOPED before outer references) ---
  const prescanDerivedTables = () => {
    const rx = /\b(FROM|JOIN)\s*\(\s*([\s\S]*?)\s*\)\s+(?:AS\s+)?([A-Za-z_]\w*)/gi;
    let m;
    while ((m = rx.exec(s))) {
      const inner = m[2];
      const alias = m[3];
      if (!inner || !alias) continue;

      const anonAlias = mapAlias(alias);
      derivedAliasSet.add(anonAlias);

      const tokens =
        inner.match(/"(?:[^"]+)"|`(?:[^`]+)`|\[(?:[^\]]+)\]|\b[A-Za-z_]\w*\b/g) || [];
      let prevUpper = "";
      for (const t of tokens) {
        const { value } = unwrapIdent(t);
        const upperTok = String(value).toUpperCase();

        if (
          prevUpper === "FROM" ||
          prevUpper === "JOIN" ||
          prevUpper === "UPDATE" ||
          prevUpper === "INTO" ||
          prevUpper === "DELETE"
        ) {
          prevUpper = upperTok;
          continue;
        }
        if (prevUpper === "AS") {
          prevUpper = upperTok;
          continue;
        }

        if (shouldSkipWord(value)) {
          prevUpper = upperTok;
          continue;
        }

        mapColumn(t); // unscoped
        prevUpper = upperTok;
      }
    }
  };

  prescanDerivedTables();

  // Protect DELETE FROM so the generic FROM/JOIN rule doesn't rewrite it first
  s = s.replace(/\bDELETE\s+FROM\b/gi, "DELETE @@DEL_FROM@@");

  // 5) anonymise relations + aliases in key clauses (+ bind alias->relation)
  s = s.replace(
    new RegExp(
      `\\b(FROM|JOIN)\\s+(${relPattern.source})(?:\\s+(?:AS\\s+)?(?!${AFTER_REL_NEG}\\b)([A-Za-z_]\\w*))?`,
      "gi"
    ),
    (match, kw, rel, alias) => {
      if (rel.startsWith("(")) return match;

      // if already an anonymised relation name, keep it
      if (relationAnonSet.has(rel) || isNatoBaseWord(rel)) {
        const anonAlias = safeAliasOrNull(alias);
        if (anonAlias) aliasToRel.set(anonAlias, rel);
        return `${kw} ${rel}${anonAlias ? " " + anonAlias : ""}`;
      }

      const anonRel = mapQualifiedRelation(rel);

      const anonAlias = safeAliasOrNull(alias);
      if (anonAlias) aliasToRel.set(anonAlias, anonRel);

      return `${kw} ${anonRel}${anonAlias ? " " + anonAlias : ""}`;
    }
  );

  s = s.replace(
    new RegExp(`\\bUPDATE\\s+(${relPattern.source})(?:\\s+(?:AS\\s+)?([A-Za-z_]\\w*))?`, "gi"),
    (m, rel, alias) => {
      if (rel.startsWith("(")) return m;

      const anonRel = relationAnonSet.has(rel) || isNatoBaseWord(rel) ? rel : mapQualifiedRelation(rel);

      if (alias && isKeyword(alias)) {
        return `UPDATE ${anonRel} ${alias}`;
      }

      const anonAlias = safeAliasOrNull(alias);
      if (anonAlias) aliasToRel.set(anonAlias, anonRel);

      return `UPDATE ${anonRel}${anonAlias ? " " + anonAlias : ""}`;
    }
  );

  s = s.replace(new RegExp(`\\bINSERT\\s+INTO\\s+(${relPattern.source})`, "gi"), (m, rel) => {
    return `INSERT INTO ${relationAnonSet.has(rel) || isNatoBaseWord(rel) ? rel : mapQualifiedRelation(rel)}`;
  });

  s = s.replace(
    new RegExp(`\\bDELETE\\s+@@DEL_FROM@@\\s+(${relPattern.source})(?:\\s+(?:AS\\s+)?([A-Za-z_]\\w*))?`, "gi"),
    (m, rel, alias) => {
      const anonRel = relationAnonSet.has(rel) || isNatoBaseWord(rel) ? rel : mapQualifiedRelation(rel);

      if (alias && isKeyword(alias)) {
        return `DELETE FROM ${anonRel} ${alias}`;
      }

      const anonAlias = safeAliasOrNull(alias);
      if (anonAlias) aliasToRel.set(anonAlias, anonRel);

      return `DELETE FROM ${anonRel}${anonAlias ? " " + anonAlias : ""}`;
    }
  );

  s = s.replace(
    new RegExp(
      `\\b(CREATE\\s+TABLE|ALTER\\s+TABLE|DROP\\s+TABLE|TRUNCATE\\s+TABLE)\\s+(${relPattern.source})`,
      "gi"
    ),
    (m, kw, rel) => `${kw} ${relationAnonSet.has(rel) || isNatoBaseWord(rel) ? rel : mapQualifiedRelation(rel)}`
  );

  // 5b) derived tables: FROM ( ... ) alias  / JOIN ( ... ) alias
  s = s.replace(
    /\b(FROM|JOIN)\s*\(\s*([\s\S]*?)\s*\)\s+(?:AS\s+)?([A-Za-z_]\w*)/gi,
    (m, kw, inner, alias) => {
      const anonAlias = mapAlias(alias);
      derivedAliasSet.add(anonAlias);
      return `${kw} (${inner}) ${anonAlias}`;
    }
  );

  // 6) qualified identifiers: left.right
  s = s.replace(/([A-Za-z0-9_`"\[\]\.]+)\.([A-Za-z0-9_`"\[\]\*]+)/g, (m, left, right) => {
    if (left.includes("@@") || right.includes("@@")) return m;

    const { value: rightVal } = unwrapIdent(right);
    const rightPlain = rightVal;

    const rightIsAnonRel = relationAnonSet.has(rightVal) || isNatoBaseWord(rightVal);
    const leftIsAnonChain = isAnonRelationChain(left, relationAnonSet);

    // ✅ If this is already an anonymised relation chain like Alpha.Bravo(.Charlie), KEEP IT.
    if (leftIsAnonChain && rightIsAnonRel) return m;

    const leftKey = keyForIdent(left, null);

    // real alias (u.id)
    if (aliasMap.has(leftKey)) {
      const anonAlias = aliasMap.get(leftKey);
      const scope = aliasToRel.get(anonAlias) || anonAlias;
      return `${anonAlias}.${rightPlain === "*" ? "*" : mapColumn(right, scope)}`;
    }

    // already anonymised alias (t1.id)
    if (/^t\d+$/i.test(left)) {
      const scope = aliasToRel.get(left) || left;
      return `${left}.${rightPlain === "*" ? "*" : mapColumn(right, scope)}`;
    }

    // implicit alias: relationName.column (cte/table used like o.user_id)
    if (!left.includes(".") && !relationAnonSet.has(left) && !isNatoBaseWord(left)) {
      const leftKeySimple = keyForIdent(left, null);
      if (relationMap.has(leftKeySimple)) {
        const anonRel = relationMap.get(leftKeySimple);
        const anonAlias = mapAlias(left);

        implicitAliasKeys.add(leftKeySimple);
        aliasToRel.set(anonAlias, anonRel);

        if (rightPlain === "*") return `${anonAlias}.*`;
        return `${anonAlias}.${mapColumn(right, anonRel)}`;
      }
    }

    // otherwise: treat left as relation chain, right as column (except '*')
    const anonLeft = leftIsAnonChain ? left : mapQualifiedRelation(left);
    if (rightPlain === "*") return `${anonLeft}.*`;

    // if left is already-anon relation chain, don’t re-map it again
    return `${anonLeft}.${mapColumn(right, anonLeft)}`;
  });

  // 7) anonymise qualified columns for aliases (covers cases after FROM/JOIN alias mapping)
  const IDENT = `\\*|"(?:[^"]+)"|\`(?:[^\`]+)\`|\\[(?:[^\\]]+)\\]|[A-Za-z_]\\w*`;

  for (const [realAliasKey, anonAlias] of aliasMap.entries()) {
    const r = new RegExp(`\\b${escapeRegExp(realAliasKey)}\\.(${IDENT})`, "gi");
    s = s.replace(r, (_, col) => {
      const scope = aliasToRel.get(anonAlias) || anonAlias;
      return `${anonAlias}.${col === "*" ? "*" : mapColumn(col, scope)}`;
    });
  }

  for (const anonAlias of aliasMap.values()) {
    const r = new RegExp(`\\b${escapeRegExp(anonAlias)}\\.(${IDENT})`, "g");
    s = s.replace(r, (_, col) => {
      const scope = aliasToRel.get(anonAlias) || anonAlias;
      return `${anonAlias}.${col === "*" ? "*" : mapColumn(col, scope)}`;
    });
  }

  // Inject implicit aliases into FROM/JOIN for relations that were used as qualifiers
  for (const realKey of implicitAliasKeys) {
    const anonRel = relationMap.get(realKey);
    const anonAlias = aliasMap.get(realKey);
    if (!anonRel || !anonAlias) continue;

    aliasToRel.set(anonAlias, anonRel);

    const inj = new RegExp(
      `\\b(FROM|JOIN)\\s+${escapeRegExp(anonRel)}(?!\\s+t\\d+)\\s*(?=\\b(ON|USING|WHERE|JOIN|LEFT|RIGHT|FULL|INNER|OUTER|GROUP|ORDER|HAVING|LIMIT|OFFSET|UNION|EXCEPT|INTERSECT|$))`,
      "gi"
    );

    s = s.replace(inj, (m, kw) => `${kw} ${anonRel} ${anonAlias} `);
  }

  // 8) anonymise column aliases INSIDE SELECT list only
  s = s.replace(/(\bSELECT\b[\s\S]*?\bFROM\b)/gi, (segment) =>
    segment.replace(/\bAS\s+([A-Za-z_]\w*)\b/gi, (m, a) => `AS ${mapColAlias(a)}`)
  );

  // 8b) anonymise USING(...) column list
  s = s.replace(/\bUSING\s*\(\s*([^)]+?)\s*\)/gi, (m, inner) => {
    const parts = inner.split(",").map((p) => p.trim()).filter(Boolean);

    const mapped = parts
      .map((p) => {
        const { value, wrap } = unwrapIdent(p);

        // Never map anonymised relations / NATO words in USING()
        if (relationAnonSet.has(value) || isNatoBaseWord(value)) return p;

        // If someone put a relation name there, keep it as relation
        const k = keyForIdent(value, wrap);
        if (relationMap.has(k)) return mapQualifiedRelation(p);

        return mapColumn(p);
      })
      .join(",");

    return `USING(${mapped})`;
  });

  // helper: find CTE scope (if any) for an offset
  const cteScopeAt = (offset) => {
    for (const r of cteRanges) {
      if (offset >= r.start && offset < r.end) return r.scope;
    }
    return null;
  };

  // 9) anonymise unqualified identifiers as columns (plus quoted identifiers)
  s = s.replace(
    /"(?:[^"]+)"|`(?:[^`]+)`|\[(?:[^\]]+)\]|\b[A-Za-z_]\w*\b/g,
    (token, offset, full) => {
      const { value, wrap } = unwrapIdent(token);

      // protected string placeholder area: @@STR0@@ (token might match STR0)
      if (
        full.slice(offset - 2, offset) === "@@" &&
        full.slice(offset + token.length, offset + token.length + 2) === "@@"
      ) {
        return token;
      }

      // named params :email / @email -> leave identifier untouched
      const prev = full[offset - 1];
      if (prev === ":" || prev === "@") return token;

      // ✅ extra-hard skip for NATO words / anonymised relations
      if (relationAnonSet.has(value) || isNatoBaseWord(value)) return token;

      // if this token is a known relation/CTE identifier, ensure it's a relation, not a column
      const relKey = keyForIdent(value, wrap);
      if (relationMap.has(relKey)) return mapQualifiedRelation(token);

      if (shouldSkipWord(value)) return token;

      const k = keyForIdent(value, wrap);
      if (aliasMap.has(k)) return aliasMap.get(k);
      if (colAliasMap.has(k)) return colAliasMap.get(k);

      // ✅ If we are inside a CTE body, scope unqualified identifiers to that CTE
      const scope = cteScopeAt(offset);
      if (scope) return mapColumn(token, scope);

      return mapColumn(token);
    }
  );

  // 10) restore strings -> lorem rules
  const isTimestamp = (content) =>
    /^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}:\d{2})?$/.test(content);

  const anonymiseStringContent = (content) => {
    const lead = (content.match(/^[%_]+/) || [""])[0];
    const trail = (content.match(/[%_]+$/) || [""])[0];
    const hasWild = lead.length > 0 || trail.length > 0 || content.includes("_");

    if (!hasWild) return "lorem ipsum";
    if (lead && !trail) return `${lead}lorem ipsum`;
    if (!lead && trail) return `lorem${trail}`;
    return `${lead}lorem${trail}`;
  };

  s = s.replace(/@@STR(\d+)@@/g, (_, i) => {
    const raw = strings[Number(i)];
    const inner = raw.slice(1, -1);
    if (isTimestamp(inner)) return raw;
    return `'${anonymiseStringContent(inner)}'`;
  });

  // unprotect DELETE FROM
  s = s.replace(/DELETE\s+@@DEL_FROM@@/g, "DELETE FROM");

  return s.trim();
}