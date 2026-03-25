import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play, Square, Upload, Code2, Terminal, Type,
  Copy, Check, Trash2, Braces, Table2,
  ChevronRight, Loader2, AlertCircle, Zap, BookOpen,
  FileCode2, Activity, Clock, Hash,
} from 'lucide-react';
import { tokenize, type Token } from './lib/lexer';
import { parse, type Program } from './lib/parser';
import { analyze, type SymbolInfo } from './lib/analyzer';
import { compileToJavaScript } from './lib/compiler';
import type { CompilationError } from './lib/errors';
import { CodeEditor } from './components/CodeEditor';

const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor;

function scrollToBottom(el: HTMLElement | null) {
  if (el) el.scrollTop = el.scrollHeight;
}

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
  const [output, setOutput] = useState<string[]>([
    '▸  MiniTS IDE listo.',
    '▸  Presiona ⌘ + Enter para compilar y ejecutar.',
  ]);
  const [generatedJS, setGeneratedJS] = useState<string>('// El JS compilado aparecerá aquí\n');
  const [tokensList, setTokensList] = useState<Token[]>([]);
  const [astData, setAstData] = useState<Program | null>(null);
  const [symbolTable, setSymbolTable] = useState<SymbolInfo[]>([]);
  const [activeTab, setActiveTab] = useState<'js' | 'lexer' | 'syntax' | 'semantic'>('js');

  const [isAwaitingInput, setIsAwaitingInput] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [inputPrompt, setInputPrompt] = useState('');
  const [inputValue, setInputValue] = useState('');

  const [copiedJS, setCopiedJS] = useState(false);
  const [errorCount, setErrorCount] = useState(0);
  const [executionTime, setExecutionTime] = useState<number | null>(null);
  const [fileName, setFileName] = useState('source.mts');

  const resolveInputRef = useRef<((value: string | null) => void) | null>(null);
  const consoleRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { scrollToBottom(consoleRef.current); }, [output]);
  useEffect(() => { if (isAwaitingInput) inputRef.current?.focus(); }, [isAwaitingInput]);

  const appendOutput = useCallback((line: string) => {
    setOutput((prev) => [...prev, line]);
  }, []);

  const handleRun = useCallback(async () => {
    if (isRunning) {
      resolveInputRef.current?.(null);
      resolveInputRef.current = null;
      setIsRunning(false);
      setIsAwaitingInput(false);
      appendOutput('\n◼  Ejecución detenida por el usuario.');
      return;
    }

    const t0 = performance.now();
    setIsRunning(true);
    setErrorCount(0);
    setExecutionTime(null);
    setOutput(['▸  Compilando…']);
    setGeneratedJS('// Compilando…');
    setTokensList([]);
    setAstData(null);
    setSymbolTable([]);

    try {
      const lexResult = tokenize(code);
      setTokensList(lexResult.tokens);
      let allErrors: CompilationError[] = [...lexResult.errors];

      const parseResult = parse(lexResult.tokens);
      allErrors = allErrors.concat(parseResult.errors);
      setAstData(parseResult.ast);

      if (parseResult.ast) {
        const semanticResult = analyze(parseResult.ast);
        allErrors = allErrors.concat(semanticResult.errors);
        setSymbolTable(semanticResult.symbols);
      }

      if (allErrors.length > 0) {
        setErrorCount(allErrors.length);
        setGeneratedJS('// Compilación detenida por errores.');
        const msgs = allErrors.map(
          (e) => `  ✕ [${e.source?.toUpperCase() || 'ERROR'}] Línea ${e.line}:${e.column}  ${e.message}`
        );
        setOutput([
          `✕  ${allErrors.length} error${allErrors.length > 1 ? 'es' : ''} de compilación:\n`,
          ...msgs,
        ]);
        setIsRunning(false);
        return;
      }

      const jsCode = compileToJavaScript(parseResult.ast!);
      setGeneratedJS(jsCode);
      setOutput(['▸  Compilación exitosa. Ejecutando…\n']);

      const __env = {
        print: (val: unknown) => { appendOutput(String(val)); },
        read: async (varName: string) => {
          setIsAwaitingInput(true);
          setInputPrompt(`› ${varName}: `);
          return new Promise<string>((resolve, reject) => {
            resolveInputRef.current = (value: string | null) => {
              if (value === null) reject(new Error('Ejecución abortada'));
              else resolve(value);
            };
          });
        },
      };

      const execute = new AsyncFunction('__env', jsCode);
      await execute(__env);

      const elapsed = ((performance.now() - t0) / 1000).toFixed(3);
      setExecutionTime(parseFloat(elapsed));
      appendOutput(`\n✔  Proceso terminado en ${elapsed}s  (código 0)`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg !== 'Ejecución abortada') appendOutput(`\n✕  Error de ejecución: ${msg}`);
    } finally {
      setIsRunning(false);
      setIsAwaitingInput(false);
    }
  }, [isRunning, code, appendOutput]);

  // Global ⌘+Enter shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleRun();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleRun]);

  const handleInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (resolveInputRef.current) {
      appendOutput(inputPrompt + inputValue);
      resolveInputRef.current(inputValue);
      setIsAwaitingInput(false);
      setInputValue('');
      resolveInputRef.current = null;
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => { if (ev.target?.result) setCode(ev.target.result as string); };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleCopyJS = () => {
    navigator.clipboard.writeText(generatedJS).then(() => {
      setCopiedJS(true);
      setTimeout(() => setCopiedJS(false), 2000);
    });
  };

  const downloadFile = () => {
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const lineCount = code.split('\n').length;
  const charCount = code.length;

  const tabs = [
    { id: 'js' as const, label: 'JS Destino', icon: <Code2 className="w-3.5 h-3.5 shrink-0" /> },
    { id: 'lexer' as const, label: 'Léxico', icon: <Type className="w-3.5 h-3.5 shrink-0" /> },
    { id: 'syntax' as const, label: 'AST', icon: <Braces className="w-3.5 h-3.5 shrink-0" /> },
    { id: 'semantic' as const, label: 'Símbolos', icon: <Table2 className="w-3.5 h-3.5 shrink-0" /> },
  ] as const;

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden app-bg">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="header-bar flex items-center justify-between px-5 py-2.5 shrink-0 z-10">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="brand-icon flex items-center justify-center w-9 h-9 rounded-xl">
            <Zap className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <h1 className="text-[15px] font-bold brand-title leading-none tracking-tight">MiniTS IDE</h1>
            <p className="text-[10px] text-zinc-600 tracking-[0.15em] uppercase mt-0.5">
              Compilador Educativo · v1.0
            </p>
          </div>
        </div>

        {/* Centre breadcrumb */}
        <div className="hidden md:flex items-center gap-2 text-xs text-zinc-600 font-mono">
          <FileCode2 className="w-3.5 h-3.5 text-indigo-500" />
          <span className="text-zinc-400">{fileName}</span>
          <span className="text-zinc-700">·</span>
          <span className="flex items-center gap-1">
            <Hash className="w-3 h-3" />{lineCount} líneas
          </span>
          {isRunning && (
            <span className="flex items-center gap-1.5 text-amber-400 ml-3">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 pulse-dot" />
              RUNNING
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2.5">
          {errorCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg error-badge text-xs font-medium">
              <AlertCircle className="w-3.5 h-3.5" />
              {errorCount} error{errorCount > 1 ? 'es' : ''}
            </div>
          )}
          {executionTime !== null && errorCount === 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg success-badge text-xs font-medium">
              <Clock className="w-3.5 h-3.5" />
              {executionTime}s
            </div>
          )}

          {/* Download */}
          <button
            onClick={downloadFile}
            title="Descargar .mts"
            className="toolbar-btn flex items-center gap-1.5 px-3 py-2 rounded-xl cursor-pointer text-xs font-medium"
          >
            <FileCode2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Guardar</span>
          </button>

          {/* Upload */}
          <label className="toolbar-btn flex items-center gap-1.5 px-3 py-2 rounded-xl cursor-pointer text-xs font-medium">
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Cargar</span>
            <input type="file" accept=".mts,.txt" className="hidden" onChange={handleFileUpload} />
          </label>

          {/* Run / Stop */}
          <button
            onClick={handleRun}
            title={isRunning ? 'Detener (⌘↩)' : 'Compilar y Ejecutar (⌘↩)'}
            className={`run-btn flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold ${isRunning ? 'run-btn--stop' : 'run-btn--go'}`}
          >
            {isRunning ? (
              <><Loader2 className="w-4 h-4 animate-spin" /><span>Detener</span><Square className="w-3 h-3 fill-current" /></>
            ) : (
              <><Play className="w-4 h-4 fill-current" /><span>Ejecutar</span><kbd className="shortcut-badge">⌘↩</kbd></>
            )}
          </button>
        </div>
      </header>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-3 px-3 pb-2 pt-3 min-h-0">

        {/* Left: Code Editor */}
        <div className="glass-panel rounded-2xl flex flex-col overflow-hidden">
          <div className="window-titlebar flex items-center px-4 py-2.5 gap-3 shrink-0">
            <div className="flex gap-1.5">
              <div className="traffic-dot bg-[#ff5f57]" />
              <div className="traffic-dot bg-[#febc2e]" />
              <div className="traffic-dot bg-[#28c840]" />
            </div>
            <span className="text-zinc-500 text-[11px] font-mono ml-2 select-none flex items-center gap-1.5">
              <ChevronRight className="w-3 h-3 text-zinc-600" />
              {fileName}
            </span>
            <div className="ml-auto flex items-center gap-3 text-[10px] font-mono text-zinc-700">
              <span className="flex items-center gap-1">
                <Activity className="w-3 h-3" />
                MiniTS
              </span>
            </div>
          </div>
          <CodeEditor value={code} onChange={setCode} onRun={handleRun} />
        </div>

        {/* Right panels */}
        <div className="flex flex-col gap-3 min-h-0">

          {/* Analysis tabs */}
          <div className="glass-panel rounded-2xl flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="window-titlebar flex items-center px-3 py-2 gap-1 shrink-0 overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`tab-btn flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold tracking-wide whitespace-nowrap transition-all ${activeTab === tab.id ? 'tab-btn--active' : 'tab-btn--inactive'}`}
                >
                  {tab.icon}{tab.label}
                </button>
              ))}
              {activeTab === 'js' && (
                <button onClick={handleCopyJS} title="Copiar JS"
                  className="ml-auto toolbar-btn-sm flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium">
                  {copiedJS ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedJS ? 'Copiado' : 'Copiar'}
                </button>
              )}
              {activeTab === 'lexer' && tokensList.length > 0 && (
                <span className="ml-auto text-[10px] font-mono text-zinc-600 px-2">
                  {tokensList.length} tokens
                </span>
              )}
              {activeTab === 'semantic' && symbolTable.length > 0 && (
                <span className="ml-auto text-[10px] font-mono text-zinc-600 px-2">
                  {symbolTable.length} símbolo{symbolTable.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            <div className="flex-1 panel-content m-2 rounded-xl overflow-auto text-sm">
              {activeTab === 'js' && (
                <pre className="syn-js font-mono text-xs leading-relaxed p-4 whitespace-pre-wrap break-all">{generatedJS}</pre>
              )}
              {activeTab === 'lexer' && (
                <div className="p-3 flex flex-col gap-0.5">
                  {tokensList.length === 0 ? <EmptyState text="Ejecuta el código para ver los tokens" /> : (
                    <>
                      <div className="flex font-mono text-[10px] text-zinc-600 uppercase tracking-wider pb-1.5 border-b border-white/5 mb-1 px-2">
                        <span className="w-20 shrink-0">Pos</span>
                        <span className="w-36 shrink-0">Tipo</span>
                        <span>Valor</span>
                      </div>
                      {tokensList.map((tok, i) => (
                        <div key={i} className="flex font-mono text-xs border-b border-white/[0.04] py-0.5 px-2 hover:bg-white/[0.04] rounded transition-colors">
                          <span className="w-20 text-zinc-600 shrink-0">{tok.line}:{tok.column}</span>
                          <span className={`w-36 shrink-0 font-semibold token-type-${tok.type.toLowerCase()}`}>{tok.type}</span>
                          <span className="text-zinc-300 truncate">'{tok.value}'</span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
              {activeTab === 'syntax' && (
                <div className="p-4">
                  {!astData ? <EmptyState text="Ejecuta el código exitosamente para ver el AST" /> : (
                    <pre className="text-purple-400/80 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all">
                      {JSON.stringify(astData, null, 2)}
                    </pre>
                  )}
                </div>
              )}
              {activeTab === 'semantic' && (
                <div className="p-3">
                  {symbolTable.length === 0 ? <EmptyState text="No hay variables declaradas o código no ejecutado" /> : (
                    <table className="w-full text-left font-mono text-xs">
                      <thead>
                        <tr className="border-b border-white/10">
                          {['Nombre', 'Tipo', 'Init', 'Usos', 'Línea'].map((h) => (
                            <th key={h} className="py-2 pr-4 text-zinc-500 font-semibold uppercase tracking-wider text-[10px]">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {symbolTable.map((sym, i) => (
                          <tr key={i} className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors">
                            <td className="py-1.5 pr-4 text-indigo-400 font-semibold">{sym.name}</td>
                            <td className="pr-4 text-amber-400">{sym.type}</td>
                            <td className="pr-4">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${sym.isInitialized ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
                                {sym.isInitialized ? 'Sí' : 'No'}
                              </span>
                            </td>
                            <td className="pr-4 text-zinc-400">{sym.usageCount}</td>
                            <td className="text-zinc-600">{sym.line}:{sym.column}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Console */}
          <div className="glass-panel rounded-2xl flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="window-titlebar flex items-center px-4 py-2.5 shrink-0">
              <span className="text-zinc-400 text-xs font-semibold tracking-wider uppercase flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                Consola
              </span>
              {isRunning && (
                <span className="ml-3 flex items-center gap-1.5 text-[10px] text-green-400 font-medium font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 pulse-dot" />
                  ejecutando
                </span>
              )}
              {!isRunning && output.length > 0 && (
                <span className="ml-3 text-[10px] font-mono text-zinc-700">
                  {output.length} línea{output.length !== 1 ? 's' : ''}
                </span>
              )}
              <button
                onClick={() => { setOutput(['▸  Consola limpiada.']); setErrorCount(0); setExecutionTime(null); }}
                title="Limpiar consola"
                className="ml-auto toolbar-btn-sm p-1.5 rounded-lg"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <div ref={consoleRef} className="flex-1 console-body flex flex-col p-4 overflow-auto">
              <div className="flex-1 font-mono text-xs leading-relaxed">
                {output.map((line, i) => (
                  <div key={i} className={`console-line ${getConsoleLineClass(line)}`}>{line}</div>
                ))}
              </div>
              {isAwaitingInput && (
                <form onSubmit={handleInputSubmit} className="flex items-center gap-2 mt-2 border-t border-white/5 pt-2.5">
                  <span className="text-indigo-400 font-mono text-xs shrink-0">{inputPrompt}</span>
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    className="flex-1 bg-transparent border-none outline-none text-zinc-100 font-mono text-xs caret-indigo-400"
                    placeholder="Escribe y pulsa Enter…"
                  />
                  <button type="submit" className="text-zinc-600 hover:text-indigo-400 transition-colors">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* ── Footer status bar ──────────────────────────────────────────── */}
      <footer className="app-statusbar flex items-center justify-between px-5 py-1.5 shrink-0">
        <span className="flex items-center gap-1.5 text-zinc-700">
          <BookOpen className="w-3 h-3" />
          MiniTS IDE — Compiladores
        </span>
        <div className="hidden sm:flex items-center gap-3 text-zinc-700">
          <span className="flex items-center gap-1 text-zinc-600">
            <span className="text-indigo-600">⌘↩</span> Ejecutar/Detener
          </span>
          <span className="opacity-30">·</span>
          <span><span className="text-indigo-600">Tab</span> → 2 espacios</span>
          <span className="opacity-30">·</span>
          <span><span className="text-indigo-600">Shift+Tab</span> → des-indentar</span>
          <span className="opacity-30">·</span>
          <span><span className="text-indigo-600">&#123; ( "</span> → autopareado</span>
        </div>
        <div className="flex items-center gap-2 text-zinc-700">
          <span className="text-[10px] font-mono">
            {charCount.toLocaleString()} chars · {lineCount} ln
          </span>
        </div>
      </footer>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-24 text-zinc-700 gap-2">
      <div className="text-2xl opacity-30">○</div>
      <span className="italic text-xs font-mono">{text}…</span>
    </div>
  );
}

function getConsoleLineClass(line: string): string {
  if (line.startsWith('✕') || line.includes('[ERROR]')) return 'console-line--error';
  if (line.startsWith('✔') || line.includes('terminado')) return 'console-line--success';
  if (line.startsWith('▸') || line.startsWith('◼')) return 'console-line--info';
  if (line.startsWith('›') || line.startsWith('  ✕')) return 'console-line--warn';
  return 'console-line--default';
}

export default App;
