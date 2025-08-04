import * as esprima from "esprima";
import estraverse from "estraverse";
import escodegen from "escodegen";

const natoAlphabet = [
  "Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "Golf", "Hotel",
  "India", "Juliett", "Kilo", "Lima", "Mike", "November", "Oscar", "Papa",
  "Quebec", "Romeo", "Sierra", "Tango", "Uniform", "Victor", "Whiskey",
  "Xray", "Yankee", "Zulu"
];

let varCounter = 0;
let funcCounter = 0;
let classCounter = 0;

function generateName(type) {
  if (type === "variable") {
    return natoAlphabet[varCounter++ % natoAlphabet.length];
  } else if (type === "function") {
    return `Function${++funcCounter}`;
  } else if (type === "class") {
    return `Class${++classCounter}`;
  } else if (type === "property") {
    return natoAlphabet[varCounter++ % natoAlphabet.length];
  }
}

let scopeStack = [];
const propertyMap = new Map();

const nativeIdentifiers = new Set([
  // Mots-clés JavaScript
  "break", "case", "catch", "class", "const", "continue", "debugger", "default", "delete",
  "do", "else", "export", "extends", "finally", "for", "function", "if", "import", "in",
  "instanceof", "new", "return", "super", "switch", "this", "throw", "try", "typeof", "var",
  "void", "while", "with", "yield", "let", "static", "await", "enum", "implements", "package",
  "protected", "interface", "private", "public",

  // Objets globaux et classes natives
  "Array", "ArrayBuffer", "BigInt", "BigInt64Array", "BigUint64Array", "Boolean",
  "DataView", "Date", "decodeURI", "decodeURIComponent", "encodeURI", "encodeURIComponent",
  "Error", "eval", "EvalError", "Float32Array", "Float64Array", "Function", "Infinity",
  "Int16Array", "Int32Array", "Int8Array", "isFinite", "isNaN", "JSON", "Map", "Math", "NaN",
  "Number", "Object", "parseFloat", "parseInt", "Promise", "Proxy", "RangeError", "ReferenceError",
  "Reflect", "RegExp", "Set", "String", "Symbol", "SyntaxError", "TypeError", "Uint16Array",
  "Uint32Array", "Uint8Array", "Uint8ClampedArray", "undefined", "URIError", "WeakMap",
  "WeakSet", "console", "window", "globalThis", "global", "self", "document", "arguments",

  // Asynchronous helpers
  "setTimeout", "clearTimeout", "setInterval", "clearInterval", "queueMicrotask", "requestAnimationFrame",
  "cancelAnimationFrame", "fetch",

  // Common names to protect in context
  "resolve", "reject", "next", "callback", "done", "require", "exports", "module",

  // JS reserved symbols
  "constructor", "prototype", "__proto__",

  // Méthodes des prototypes natifs
  "filter", "map", "forEach", "reduce", "some", "every", "find", "findIndex",
  "push", "pop", "shift", "unshift", "slice", "splice", "indexOf", "includes",
  "flat", "flatMap", "sort", "reverse", "join", "concat", "length",

  "add", "clear", "delete", "entries", "get", "has", "keys", "set", "values", "size",

  "bind", "call", "apply", "then", "catch", "finally", "toString", "valueOf"

]);

export function anonymiseJS(sourceCode) {
  try {
    const ast = esprima.parseModule(sourceCode, { comment: true, loc: true, range: true });
    scopeStack = [new Map()];
    propertyMap.clear();
    varCounter = 0;
    funcCounter = 0;
    classCounter = 0;

    estraverse.traverse(ast, {
      enter(node, parent) {
        if (["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression"].includes(node.type)) {
          scopeStack.push(new Map());

          node.params.forEach(param => {
            if (param.type === "Identifier" && !nativeIdentifiers.has(param.name)) {
              const newName = generateName("variable");
              scopeStack[scopeStack.length - 1].set(param.name, newName);
              param.name = newName;
            }
          });

          // 🧠 Spécial : détecter les affectations dans les constructeurs
          if (
            node.type === "FunctionExpression" &&
            parent?.type === "MethodDefinition" &&
            parent.kind === "constructor"
          ) {
            const assignments = node.body.body.filter(
              stmt =>
                stmt.type === "ExpressionStatement" &&
                stmt.expression.type === "AssignmentExpression" &&
                stmt.expression.left.type === "MemberExpression" &&
                stmt.expression.left.object.type === "ThisExpression" &&
                stmt.expression.left.property.type === "Identifier" &&
                stmt.expression.right.type === "Identifier"
            );

            for (const assign of assignments) {
              const propName = assign.expression.left.property.name;
              const paramName = assign.expression.right.name;

              for (let i = scopeStack.length - 1; i >= 0; i--) {
                if (scopeStack[i].has(paramName)) {
                  const anonParam = scopeStack[i].get(paramName);
                  propertyMap.set(propName, anonParam);
                  break;
                }
              }
            }
          }
        }

        if (node.type === "VariableDeclarator" && node.id.type === "Identifier" && !nativeIdentifiers.has(node.id.name)) {
          const currentScope = scopeStack[scopeStack.length - 1];
          if (!currentScope.has(node.id.name)) {
            const newName = generateName("variable");
            currentScope.set(node.id.name, newName);
          }
          node.id.name = currentScope.get(node.id.name);
        }

        if (node.type === "Identifier") {
          if (
            !nativeIdentifiers.has(node.name) &&
            parent &&
            parent.type !== "VariableDeclarator" &&
            parent.type !== "FunctionDeclaration" &&
            parent.type !== "ClassDeclaration" &&
            !(parent.type === "MemberExpression" && parent.property === node && !parent.computed) &&
            !(parent.type === "MethodDefinition" && parent.key === node && !parent.computed)
          ) {
            for (let i = scopeStack.length - 1; i >= 0; i--) {
              if (scopeStack[i].has(node.name)) {
                node.name = scopeStack[i].get(node.name);
                break;
              }
            }
          }
        }

        // Gérer les propriétés this.xxx ou obj.xxx
        if (
          node.type === "MemberExpression" &&
          ((node.property.type === "Identifier" && !node.computed) || node.property.type === "Literal")
        ) {
          const propName = node.property.name || node.property.value;
          if (typeof propName === "string" && !nativeIdentifiers.has(propName)) {
            if (!propertyMap.has(propName)) {
              propertyMap.set(propName, generateName("property"));
            }

            if (node.computed) {
              node.property = {
                type: "Literal",
                value: propertyMap.get(propName),
                raw: `'${propertyMap.get(propName)}'`
              };
            } else {
              node.property.name = propertyMap.get(propName);
            }
          }
        }

        // Renommer les noms de méthodes (ex: get calcArea() {})
        if ((node.type === "Property" || node.type === "MethodDefinition") && node.key.type === "Identifier" && !node.computed) {
          const propName = node.key.name;
          if (!nativeIdentifiers.has(propName) && propName !== "constructor") {
            if (!propertyMap.has(propName)) {
              propertyMap.set(propName, generateName("property"));
            }
            node.key.name = propertyMap.get(propName);
          }
        }

        if (node.type === "FunctionDeclaration" && node.id) {
          const newName = generateName("function");
          const currentScope = scopeStack[scopeStack.length - 1];
          currentScope.set(node.id.name, newName);
          node.id.name = newName;
        }

        if (node.type === "ClassDeclaration" && node.id) {
          const newName = generateName("class");
          const currentScope = scopeStack[scopeStack.length - 1];
          currentScope.set(node.id.name, newName);
          node.id.name = newName;
        }

        if (node.type === "ClassExpression") {
          if (node.id) {
            const newName = generateName("class");
            node.id.name = newName;
          }

          if (parent?.type === "VariableDeclarator" && parent.id.type === "Identifier" && !nativeIdentifiers.has(parent.id.name)) {
            const currentScope = scopeStack[scopeStack.length - 1];
            if (!currentScope.has(parent.id.name)) {
              const newName = generateName("variable");
              currentScope.set(parent.id.name, newName);
            }
            parent.id.name = currentScope.get(parent.id.name);
          }
        }

        if (node.type === "Literal" && typeof node.value === "string") {
          node.value = "Lorem Ipsum";
          node.raw = '"Lorem Ipsum"';
        }
      },

      leave(node) {
        if (["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression"].includes(node.type)) {
          scopeStack.pop();
        }
      }
    });

    const anonymizedCode = escodegen.generate(ast, {
      comment: false,
      format: { indent: { style: "  " } }
    });

    return anonymizedCode;
  } catch (error) {
    return `// Syntax Error: ${error.message}`;
  }
}
