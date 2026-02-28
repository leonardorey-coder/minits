import { useState, useRef } from 'react';
import { Play, Upload, Code2, Terminal, Type } from 'lucide-react';
import { tokenize, type Token } from './lib/lexer';
import { parse, type Program } from './lib/parser';
import { analyze, type SymbolInfo } from './lib/analyzer';
import { compileToJavaScript } from './lib/compiler';
import type { CompilationError } from './lib/errors';
// To avoid TS warnings on AsyncFunction
const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor;

function App() {
  const [code, setCode] = useState<string>(
    `program inicio
vars {
  let x: number;
  let nombre: string;
}
main {
  read(nombre);
  x = 0;
  while (x < 3) {
    print(nombre);
    x = x + 1;
  }
}
program fin
`);
  const [output, setOutput] = useState<string>('Compilador MiniTS listo. Presiona "Compilar y Ejecutar" para ejecutar el código.');
  const [generatedJS, setGeneratedJS] = useState<string>('// El JS compilado aparecerá aquí');
  const [tokensList, setTokensList] = useState<Token[]>([]);
  const [astData, setAstData] = useState<Program | null>(null);
  const [symbolTable, setSymbolTable] = useState<SymbolInfo[]>([]);
  const [activeTab, setActiveTab] = useState<'js' | 'lexer' | 'syntax' | 'semantic'>('js');

  // Interactive console state
  const [isAwaitingInput, setIsAwaitingInput] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [inputPrompt, setInputPrompt] = useState('');
  const [inputValue, setInputValue] = useState('');

  const resolveInputRef = useRef<((value: string | null) => void) | null>(null);

  const handleRun = async () => {
    if (isRunning) {
      if (resolveInputRef.current) {
        resolveInputRef.current(null); // Abort awaiting input
        resolveInputRef.current = null;
      }
      setIsRunning(false);
      setIsAwaitingInput(false);
      setOutput((prev) => prev + '\n[Ejecución detenida por el usuario]');
      return;
    }

    setIsRunning(true);
    setOutput('');
    setGeneratedJS('// Compilando...');
    setTokensList([]);

    try {
      // 1. Lexical Analysis
      const lexResult = tokenize(code);
      setTokensList(lexResult.tokens);
      let allErrors: CompilationError[] = [...lexResult.errors];

      // 2. Syntactic Analysis & AST creation
      const parseResult = parse(lexResult.tokens);
      allErrors = allErrors.concat(parseResult.errors);
      setAstData(parseResult.ast);

      // 3. Semantic Analysis (Linting)
      if (parseResult.ast) {
        const semanticResult = analyze(parseResult.ast);
        allErrors = allErrors.concat(semanticResult.errors);
        setSymbolTable(semanticResult.symbols);
      } else {
        setSymbolTable([]);
      }

      // 4. Compilation halting
      if (allErrors.length > 0) {
        setGeneratedJS('// Compilación detenida por errores.');
        const errorStrings = allErrors.map((e) =>
          `[${e.source?.toUpperCase() || 'ERROR'} ERROR] Línea ${e.line}, Columna ${e.column}: ${e.message}`
        );
        setOutput(`Se encontraron ${allErrors.length} errores de compilación:\n\n` + errorStrings.join('\n'));
        setIsRunning(false);
        return;
      }

      // 5. Code Generation
      const jsCode = compileToJavaScript(parseResult.ast!);
      setGeneratedJS(jsCode);

      // 6. Execution setup
      const __env = {
        print: (val: any) => {
          setOutput((prev) => prev + String(val) + '\n');
        },
        read: async (varName: string) => {
          setIsAwaitingInput(true);
          setInputPrompt(`Ingresa el valor para ${varName}: `);
          return new Promise<string>((resolve, reject) => {
            resolveInputRef.current = (value: string | null) => {
              if (value === null) {
                reject(new Error("Ejecución abortada"));
              } else {
                resolve(value);
              }
            };
          });
        }
      };

      const execute = new AsyncFunction('__env', jsCode);

      // 7. Run execution
      await execute(__env);
      setOutput((prev) => prev + '\n[Proceso terminado con código 0]');

    } catch (err: any) {
      if (err.message !== "Ejecución abortada") {
        setOutput((prev) => prev + '\n[Error Interno]: ' + err.message);
      }
    } finally {
      setIsRunning(false);
      setIsAwaitingInput(false);
    }
  };

  const handleInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (resolveInputRef.current) {
      // Echo input to output
      setOutput((prev) => prev + inputPrompt + inputValue + '\n');
      resolveInputRef.current(inputValue);

      // Reset input state
      setIsAwaitingInput(false);
      setInputValue('');
      resolveInputRef.current = null;
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setCode(event.target.result as string);
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="h-screen w-screen p-4 md:p-6 lg:p-8 flex flex-col gap-6 overflow-hidden bg-[#27272a]">
      {/* Header */}
      <header className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <div className="clay-panel p-2 rounded-xl flex items-center justify-center bg-indigo-500">
            <Code2 className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              MiniTS IDE
            </h1>
            <p className="text-xs text-zinc-400 font-medium tracking-wide uppercase">Proyecto de Compilador Educativo</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <label className="clay-btn flex items-center gap-2 px-5 py-2.5 rounded-xl cursor-pointer text-sm font-semibold text-zinc-300">
            <Upload className="w-4 h-4" />
            Cargar .mts
            <input type="file" accept=".mts,.txt" className="hidden" onChange={handleFileUpload} />
          </label>
          <button
            onClick={handleRun}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold tracking-wide transition-all ${isRunning
              ? 'bg-red-500/80 hover:bg-red-500 text-white shadow-[8px_8px_16px_#1a1a1c,-8px_-8px_16px_#343438]'
              : 'clay-btn-primary'
              }`}
          >
            <Play className={`w-4 h-4 fill-current ${isRunning ? 'hidden' : ''}`} />
            {isRunning ? "Ejecutando | Clic para detener" : "Compilar y Ejecutar"}
          </button>
        </div>
      </header>

      {/* Main layout */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0">

        {/* Left Panel: Code Editor */}
        <div className="clay-panel rounded-3xl flex flex-col h-full relative group">
          <div className="h-14 border-b border-black/20 flex items-center px-6 gap-3">
            <div className="flex gap-2">
              <div className="w-3.5 h-3.5 rounded-full bg-red-500/80 shadow-inner"></div>
              <div className="w-3.5 h-3.5 rounded-full bg-yellow-500/80 shadow-inner"></div>
              <div className="w-3.5 h-3.5 rounded-full bg-green-500/80 shadow-inner"></div>
            </div>
            <span className="text-zinc-400 text-sm font-medium select-none ml-2">source.mts</span>
          </div>

          <div className="flex-1 p-4 overflow-hidden relative">
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck={false}
              className="w-full h-full resize-none bg-transparent text-zinc-200 font-mono text-sm sm:text-base focus:outline-none leading-relaxed"
              style={{ tabSize: 2 }}
            />
          </div>
        </div>

        {/* Right Panels */}
        <div className="flex flex-col gap-6 h-full min-h-0">

          {/* Top Right: Lexicon / Target Code View */}
          <div className="clay-panel rounded-3xl flex-1 flex flex-col h-1/2">
            <div className="h-14 border-b border-black/20 flex items-center px-4 justify-between">
              <div className="flex gap-2 h-full py-2 overflow-x-auto">
                <button
                  onClick={() => setActiveTab('js')}
                  className={`px-4 rounded-xl text-sm font-bold tracking-wider uppercase transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'js' ? 'bg-[#1f1f22] text-zinc-200 shadow-inner' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  <Code2 className="w-4 h-4 shrink-0" /> JS Destino
                </button>
                <button
                  onClick={() => setActiveTab('lexer')}
                  className={`px-4 rounded-xl text-sm font-bold tracking-wider uppercase transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'lexer' ? 'bg-[#1f1f22] text-zinc-200 shadow-inner' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  <Type className="w-4 h-4 shrink-0" /> Léxico
                </button>
                <button
                  onClick={() => setActiveTab('syntax')}
                  className={`px-4 rounded-xl text-sm font-bold tracking-wider uppercase transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'syntax' ? 'bg-[#1f1f22] text-zinc-200 shadow-inner' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  <Code2 className="w-4 h-4 shrink-0" /> Sintaxis (AST)
                </button>
                <button
                  onClick={() => setActiveTab('semantic')}
                  className={`px-4 rounded-xl text-sm font-bold tracking-wider uppercase transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'semantic' ? 'bg-[#1f1f22] text-zinc-200 shadow-inner' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  <Type className="w-4 h-4 shrink-0" /> Semántica (Símbolos)
                </button>
              </div>
            </div>

            <div className="flex-1 p-4 bg-[#1f1f22]/50 m-2 rounded-2xl overflow-auto clay-input border-0">
              {activeTab === 'js' && (
                <pre className="text-green-400/90 font-mono text-sm break-all whitespace-pre-wrap">{generatedJS}</pre>
              )}
              {activeTab === 'lexer' && (
                <div className="flex flex-col gap-1">
                  {tokensList.length === 0 && <span className="text-zinc-500 italic text-sm font-mono">Ejecuta el código para ver los tokens...</span>}
                  {tokensList.map((tok, i) => (
                    <div key={i} className="flex font-mono text-sm border-b border-white/5 pb-1">
                      <span className="w-12 text-zinc-500 shrink-0">[{tok.line}:{tok.column}]</span>
                      <span className="w-32 text-indigo-400 font-semibold shrink-0">{tok.type}</span>
                      <span className="text-zinc-300 truncate">'{tok.value}'</span>
                    </div>
                  ))}
                </div>
              )}
              {activeTab === 'syntax' && (
                <div className="flex flex-col gap-1">
                  {!astData && <span className="text-zinc-500 italic text-sm font-mono">Ejecuta el código exitosamente para ver el AST...</span>}
                  {astData && (
                    <pre className="text-purple-400/90 font-mono text-xs break-all whitespace-pre-wrap">
                      {JSON.stringify(astData, null, 2)}
                    </pre>
                  )}
                </div>
              )}
              {activeTab === 'semantic' && (
                <div className="flex flex-col gap-1">
                  {symbolTable.length === 0 && <span className="text-zinc-500 italic text-sm font-mono">No se encontraron variables o código no ejecutado...</span>}
                  {symbolTable.length > 0 && (
                    <div className="w-full">
                      <table className="w-full text-left font-mono text-sm">
                        <thead>
                          <tr className="border-b border-white/10 text-zinc-400">
                            <th className="py-2">Nombre</th>
                            <th>Tipo</th>
                            <th>Inicializada</th>
                            <th>Uso (Veces)</th>
                            <th>Ubicación</th>
                          </tr>
                        </thead>
                        <tbody className="text-zinc-300">
                          {symbolTable.map((sym, i) => (
                            <tr key={i} className="border-b border-white/5">
                              <td className="py-1 text-indigo-400 font-semibold">{sym.name}</td>
                              <td className="text-amber-400">{sym.type}</td>
                              <td>
                                <span className={`px-2 py-0.5 rounded text-xs ${sym.isInitialized ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                  {sym.isInitialized ? 'Sí' : 'No'}
                                </span>
                              </td>
                              <td>{sym.usageCount}</td>
                              <td className="text-zinc-500">[{sym.line}:{sym.column}]</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Bottom Right: Output Console */}
          <div className="clay-panel rounded-3xl flex-1 flex flex-col h-1/2 relative">
            <div className="h-14 border-b border-black/20 flex items-center px-6 justify-between">
              <span className="text-zinc-400 text-sm font-bold tracking-wider uppercase flex items-center gap-2">
                <Terminal className="w-4 h-4" /> Consola de Ejecución
              </span>
            </div>
            <div className="flex-1 flex flex-col p-4 text-zinc-300 font-mono text-sm m-2 rounded-2xl overflow-auto bg-[#1a1a1c] shadow-inner">
              <div className="whitespace-pre-wrap break-words flex-1">
                {output}
              </div>

              {/* Interactive Input Form */}
              {isAwaitingInput && (
                <form onSubmit={handleInputSubmit} className="flex items-center gap-2 mt-2">
                  <span className="text-indigo-400 shrink-0">{inputPrompt}</span>
                  <input
                    type="text"
                    autoFocus
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    className="flex-1 bg-transparent border-none outline-none text-zinc-100 placeholder-zinc-600"
                    placeholder="Escribe el valor y presiona Enter..."
                  />
                </form>
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

export default App;
