import { useState, useRef } from 'react';
import { Play, Upload, Code2, Terminal, Type } from 'lucide-react';
import { tokenize, type Token } from './lib/lexer';
import { parse } from './lib/parser';
import { compileToJavaScript } from './lib/compiler';

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
  const [output, setOutput] = useState<string>('MiniTS Compiler ready. Press "Compile & Run" to execute code.');
  const [generatedJS, setGeneratedJS] = useState<string>('// Target JS will appear here');
  const [tokensList, setTokensList] = useState<Token[]>([]);
  const [activeTab, setActiveTab] = useState<'js' | 'lexer'>('js');

  // Interactive console state
  const [isAwaitingInput, setIsAwaitingInput] = useState(false);
  const [inputPrompt, setInputPrompt] = useState('');
  const [inputValue, setInputValue] = useState('');

  const resolveInputRef = useRef<((value: string) => void) | null>(null);

  const handleRun = async () => {
    setOutput('');
    setGeneratedJS('// Compiling...');
    setTokensList([]);

    try {
      // 1. Lexical Analysis
      const tokens = tokenize(code);
      setTokensList(tokens);

      // 2. Syntactic Analysis & AST creation
      const ast = parse(tokens);

      // 3. Code Generation
      const jsCode = compileToJavaScript(ast);
      setGeneratedJS(jsCode);

      // 4. Execution setup
      const __env = {
        print: (val: any) => {
          setOutput((prev) => prev + String(val) + '\n');
        },
        read: async (varName: string) => {
          setIsAwaitingInput(true);
          setInputPrompt(`Enter value for ${varName}: `);
          return new Promise<string>((resolve) => {
            resolveInputRef.current = resolve;
          });
        }
      };

      const execute = new AsyncFunction('__env', jsCode);

      // 5. Run execution
      await execute(__env);
      setOutput((prev) => prev + '\n[Process exited 0]');

    } catch (err: any) {
      setOutput((prev) => prev + '\n[Error]: ' + err.message);
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
            <p className="text-xs text-zinc-400 font-medium tracking-wide uppercase">Educational Compiler Project</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <label className="clay-btn flex items-center gap-2 px-5 py-2.5 rounded-xl cursor-pointer text-sm font-semibold text-zinc-300">
            <Upload className="w-4 h-4" />
            Load .mts
            <input type="file" accept=".mts,.txt" className="hidden" onChange={handleFileUpload} />
          </label>
          <button
            onClick={handleRun}
            className="clay-btn-primary flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold tracking-wide"
            disabled={isAwaitingInput}
          >
            <Play className="w-4 h-4 fill-current" />
            {isAwaitingInput ? "Running..." : "Compile & Run"}
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
              <div className="flex gap-2 h-full py-2">
                <button
                  onClick={() => setActiveTab('js')}
                  className={`px-4 rounded-xl text-sm font-bold tracking-wider uppercase transition-all flex items-center gap-2 ${activeTab === 'js' ? 'bg-[#1f1f22] text-zinc-200 shadow-inner' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  <Code2 className="w-4 h-4" /> Target JS
                </button>
                <button
                  onClick={() => setActiveTab('lexer')}
                  className={`px-4 rounded-xl text-sm font-bold tracking-wider uppercase transition-all flex items-center gap-2 ${activeTab === 'lexer' ? 'bg-[#1f1f22] text-zinc-200 shadow-inner' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  <Type className="w-4 h-4" /> Lexicon
                </button>
              </div>
            </div>

            <div className="flex-1 p-4 bg-[#1f1f22]/50 m-2 rounded-2xl overflow-auto clay-input border-0">
              {activeTab === 'js' ? (
                <pre className="text-green-400/90 font-mono text-sm break-all whitespace-pre-wrap">{generatedJS}</pre>
              ) : (
                <div className="flex flex-col gap-1">
                  {tokensList.length === 0 && <span className="text-zinc-500 italic text-sm font-mono">Run code to see tokens...</span>}
                  {tokensList.map((tok, i) => (
                    <div key={i} className="flex font-mono text-sm border-b border-white/5 pb-1">
                      <span className="w-12 text-zinc-500">[{tok.line}:{tok.column}]</span>
                      <span className="w-32 text-indigo-400 font-semibold">{tok.type}</span>
                      <span className="text-zinc-300 truncate">'{tok.value}'</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Bottom Right: Output Console */}
          <div className="clay-panel rounded-3xl flex-1 flex flex-col h-1/2 relative">
            <div className="h-14 border-b border-black/20 flex items-center px-6 justify-between">
              <span className="text-zinc-400 text-sm font-bold tracking-wider uppercase flex items-center gap-2">
                <Terminal className="w-4 h-4" /> Execution Console
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
                    placeholder="Type value and press Enter..."
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
