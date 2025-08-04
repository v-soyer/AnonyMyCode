const natoAlphabet = [
  'Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel',
  'India', 'Juliett', 'Kilo', 'Lima', 'Mike', 'November', 'Oscar', 'Papa',
  'Quebec', 'Romeo', 'Sierra', 'Tango', 'Uniform', 'Victor', 'Whiskey',
  'Xray', 'Yankee', 'Zulu'
];

let baseMap = new Map();
let tableMap = new Map();
let columnMap = new Map();
let aliasMap = new Map();
let aliasCounter = 1;
let tableCounter = 1;
let baseCounter = 1;
let colCounter = 0;

const SQL_KEYWORDS = new Set([
  "SELECT", "FROM", "WHERE", "GROUP", "BY", "ORDER", "HAVING", "LIMIT", "OFFSET",
  "JOIN", "INNER", "LEFT", "RIGHT", "FULL", "OUTER", "ON", "USING",
  "AS", "DISTINCT", "UNION", "ALL", "EXCEPT", "INTERSECT",
  "AND", "OR", "NOT", "IN", "IS", "NULL", "BETWEEN", "LIKE", "EXISTS", "ANY", "SOME",
  "INSERT", "INTO", "VALUES", "UPDATE", "SET", "DELETE",
  "CREATE", "TABLE", "DATABASE", "ALTER", "DROP", "RENAME", "TRUNCATE",
  "INT", "INTEGER", "BIGINT", "SMALLINT", "TINYINT", "DECIMAL", "NUMERIC", "FLOAT", "REAL",
  "CHAR", "VARCHAR", "TEXT", "DATE", "TIME", "TIMESTAMP", "BOOLEAN",
  "COUNT", "SUM", "AVG", "MIN", "MAX", "NOW", "COALESCE", "CAST", "CONVERT",
  "BEGIN", "COMMIT", "ROLLBACK", "SAVEPOINT", "TRANSACTION",
  "GRANT", "REVOKE", "USER", "ROLE", "WITH",
  "CASE", "WHEN", "THEN", "ELSE", "END", "DEFAULT", "PRIMARY", "KEY", "FOREIGN",
  "REFERENCES", "CHECK", "INDEX", "VIEW", "IF", "EXISTS", "ASC", "DESC", "ESCAPE",
  "OVER", "PARTITION", "WINDOW", "RANK", "DENSE_RANK", "ROW_NUMBER"
]);

export function anonymiseSQL(sql) {
  // 🔹 Supprimer les commentaires SQL
  sql = sql.replace(/--.*|\/\*[\s\S]*?\*\//g, '');

  // 🔹 Anonymiser les bases (ex: BaseRH.Utilisateurs)
  sql = sql.replace(/([a-zA-Z0-9_]+)\./g, (match, base) => {
    if (SQL_KEYWORDS.has(base.toUpperCase())) return match;
    if (!baseMap.has(base)) baseMap.set(base, `Base${baseCounter++}`);
    return baseMap.get(base) + '.';
  });

  // 🔹 Anonymiser les noms de tables et leurs alias
  sql = sql.replace(/\b(FROM|JOIN)\s+([a-zA-Z0-9_]+)(?:\s+([a-zA-Z0-9_]+))?/gi, (match, keyword, table, alias) => {
    if (!SQL_KEYWORDS.has(table.toUpperCase()) && !tableMap.has(table)) tableMap.set(table, `Table${tableCounter++}`);
    if (alias && !SQL_KEYWORDS.has(alias.toUpperCase()) && !aliasMap.has(alias)) aliasMap.set(alias, `T${aliasCounter++}`);
    return `${keyword} ${tableMap.get(table) || table}${alias ? ' ' + (aliasMap.get(alias) || alias) : ''}`;
  });

  // 🔹 Anonymiser les alias explicites (AS)
  sql = sql.replace(/\bAS\s+([a-zA-Z0-9_]+)/gi, (match, alias) => {
    if (!SQL_KEYWORDS.has(alias.toUpperCase()) && !aliasMap.has(alias)) aliasMap.set(alias, `A${aliasCounter++}`);
    return `AS ${aliasMap.get(alias) || alias}`;
  });

  // 🔹 Anonymiser les noms de colonnes dans la clause SELECT (non préfixés)
  sql = sql.replace(/(SELECT[\s\S]*?)(\bFROM\b)/gi, (match, selectContent, fromKeyword) => {
    return selectContent.replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g, (word) => {
      if (SQL_KEYWORDS.has(word.toUpperCase()) || word.includes('.') || aliasMap.has(word)) return word;
      if (!columnMap.has(word)) {
        let colName = natoAlphabet[colCounter % natoAlphabet.length];
        if (colCounter >= natoAlphabet.length) colName += Math.floor(colCounter / natoAlphabet.length);
        columnMap.set(word, colName);
        colCounter++;
      }
      return columnMap.get(word);
    }) + fromKeyword;
  });

  // 🔹 Anonymiser les colonnes préfixées avec alias (ex: u.nom)
  aliasMap.forEach((anonAlias, realAlias) => {
    const regex = new RegExp(`\\b${realAlias}\\.([a-zA-Z0-9_]+)`, 'g');
    sql = sql.replace(regex, (match, column) => {
      if (SQL_KEYWORDS.has(column.toUpperCase())) return `${anonAlias}.${column}`;
      if (!columnMap.has(column)) {
        let colName = natoAlphabet[colCounter % natoAlphabet.length];
        if (colCounter >= natoAlphabet.length) colName += Math.floor(colCounter / natoAlphabet.length);
        columnMap.set(column, colName);
        colCounter++;
      }
      return `${anonAlias}.${columnMap.get(column)}`;
    });
  });

  // 🔹 Anonymiser les colonnes dans la clause WHERE (non préfixées)
  sql = sql.replace(/\bWHERE\s+([\s\S]*?)(;|$)/gi, (match, condition, end) => {
    return 'WHERE ' + condition.replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g, (word) => {
      if (SQL_KEYWORDS.has(word.toUpperCase())) return word;
      if (!columnMap.has(word)) {
        let colName = natoAlphabet[colCounter % natoAlphabet.length];
        if (colCounter >= natoAlphabet.length) colName += Math.floor(colCounter / natoAlphabet.length);
        columnMap.set(word, colName);
        colCounter++;
      }
      return columnMap.get(word);
    }) + end;
  });

  // 🔹 Anonymiser les chaînes de caractères (valeurs entre quotes), sauf si ce sont des timestamps
  sql = sql.replace(/'([^']*)'/g, (match, content) => {
    const isTimestamp = /^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}:\d{2})?$/.test(content);
    return isTimestamp ? `'${content}'` : `'Lorem ipsum'`;
  });
  
  return sql;
}
