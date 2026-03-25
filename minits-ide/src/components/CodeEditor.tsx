import { useRef, useCallback, useEffect, useState } from 'react';

// ─── Shared metrics — SINGLE SOURCE OF TRUTH ─────────────────────────────────
// These must be applied identically to BOTH the <pre> and the <textarea>.
const FS = 13;          // font-size in px
const LH = 1.65;        // line-height (unitless)
const PT = 10;          // padding-top / bottom in px
const PL = 12;          // padding-left / right in px
const LINE = FS * LH;     // px height of one line = 21.45

// ─── Tokeniser ────────────────────────────────────────────────────────────────
const KEYWORDS = new Set([
    'program', 'inicio', 'fin', 'vars', 'main',
    'let', 'number', 'string', 'boolean',
    'read', 'print', 'if', 'else', 'while', 'for',
]);

type Span = { text: string; cls: string };

function highlightLine(line: string): Span[] {
    const out: Span[] = [];
    let i = 0;
    while (i < line.length) {
        if (line[i] === '/' && line[i + 1] === '/') {
            out.push({ text: line.slice(i), cls: 'syn-comment' }); break;
        }
        if (line[i] === '"' || line[i] === "'") {
            const q = line[i]; let j = i + 1;
            while (j < line.length && line[j] !== q) j++;
            out.push({ text: line.slice(i, Math.min(j + 1, line.length)), cls: 'syn-string' });
            i = Math.min(j + 1, line.length); continue;
        }
        if (/[0-9]/.test(line[i])) {
            let j = i;
            while (j < line.length && /[0-9.]/.test(line[j])) j++;
            out.push({ text: line.slice(i, j), cls: 'syn-number' }); i = j; continue;
        }
        if (/[a-zA-Z_]/.test(line[i])) {
            let j = i;
            while (j < line.length && /[a-zA-Z0-9_]/.test(line[j])) j++;
            const w = line.slice(i, j);
            out.push({ text: w, cls: KEYWORDS.has(w) ? 'syn-keyword' : (w === 'true' || w === 'false') ? 'syn-boolean' : 'syn-ident' });
            i = j; continue;
        }
        if (/[=<>!+\-*/]/.test(line[i])) {
            let j = i + 1;
            if (j < line.length && /[=]/.test(line[j]) && /[=<>!]/.test(line[i])) j++;
            out.push({ text: line.slice(i, j), cls: 'syn-operator' }); i = j; continue;
        }
        if (/[{};():,]/.test(line[i])) {
            out.push({ text: line[i], cls: 'syn-punctuation' }); i++; continue;
        }
        out.push({ text: line[i], cls: 'syn-plain' }); i++;
    }
    return out;
}

// ─── Shared inline style objects (guarantees identical rendering) ─────────────
const SHARED_STYLE: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    margin: 0,
    padding: `${PT}px ${PL}px`,
    fontFamily: 'inherit',   // inherits from .code-editor-root
    fontSize: `${FS}px`,
    lineHeight: LH,
    whiteSpace: 'pre',
    wordBreak: 'normal',
    overflowWrap: 'normal',
    tabSize: 2,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    boxSizing: 'border-box',
};

// ─── Props ────────────────────────────────────────────────────────────────────
interface CodeEditorProps {
    value: string;
    onChange: (v: string) => void;
    onRun?: () => void;
}

export function CodeEditor({ value, onChange, onRun }: CodeEditorProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const hlRef = useRef<HTMLPreElement>(null);
    const gutterRef = useRef<HTMLDivElement>(null);

    const [cursorLine, setCursorLine] = useState(1);
    const [cursorCol, setCursorCol] = useState(1);

    const lines = value.split('\n');
    const lineCount = lines.length;
    const gutterW = `${Math.max(String(lineCount).length, 2) * 9 + 26}px`;

    // ── Sync scroll: textarea drives everything ──────────────────────────────────
    const syncScroll = useCallback(() => {
        const ta = textareaRef.current;
        const hl = hlRef.current;
        const gt = gutterRef.current;
        if (!ta) return;
        if (hl) { hl.scrollTop = ta.scrollTop; hl.scrollLeft = ta.scrollLeft; }
        if (gt) { gt.scrollTop = ta.scrollTop; }
    }, []);

    useEffect(() => {
        const ta = textareaRef.current;
        if (!ta) return;
        ta.addEventListener('scroll', syncScroll, { passive: true });
        return () => ta.removeEventListener('scroll', syncScroll);
    }, [syncScroll]);

    // ── Cursor tracker ───────────────────────────────────────────────────────────
    const updateCursor = useCallback(() => {
        const ta = textareaRef.current;
        if (!ta) return;
        const before = ta.value.slice(0, ta.selectionStart ?? 0).split('\n');
        setCursorLine(before.length);
        setCursorCol(before[before.length - 1].length + 1);
    }, []);

    // ── Smart keyboard ────────────────────────────────────────────────────────────
    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        const ta = e.currentTarget;

        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault(); onRun?.(); return;
        }

        if (e.key === 'Tab') {
            e.preventDefault();
            const { selectionStart: s, selectionEnd: end } = ta;
            if (e.shiftKey) {
                const ls = ta.value.lastIndexOf('\n', s - 1) + 1;
                const sp = ta.value.slice(ls, s).match(/^ {1,2}/)?.[0] ?? '';
                if (sp) {
                    onChange(ta.value.slice(0, ls) + ta.value.slice(ls + sp.length));
                    requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = s - sp.length; });
                }
            } else {
                onChange(ta.value.slice(0, s) + '  ' + ta.value.slice(end));
                requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = s + 2; });
            }
            return;
        }

        // Auto-pair
        const PAIRS: Record<string, string> = { '{': '}', '(': ')', '"': '"', "'": "'" };
        if (PAIRS[e.key] && !e.metaKey && !e.ctrlKey && !e.altKey && ta.selectionStart === ta.selectionEnd) {
            e.preventDefault();
            const s = ta.selectionStart;
            onChange(ta.value.slice(0, s) + e.key + PAIRS[e.key] + ta.value.slice(s));
            requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = s + 1; });
            return;
        }

        // Smart Enter
        if (e.key === 'Enter') {
            const s = ta.selectionStart;
            const ls = ta.value.lastIndexOf('\n', s - 1) + 1;
            const cur = ta.value.slice(ls, s);
            const indent = cur.match(/^(\s*)/)?.[1] ?? '';
            const extra = cur.trimEnd().endsWith('{') ? '  ' : '';
            e.preventDefault();
            onChange(ta.value.slice(0, s) + '\n' + indent + extra + ta.value.slice(ta.selectionEnd));
            requestAnimationFrame(() => {
                const pos = s + 1 + indent.length + extra.length;
                ta.selectionStart = ta.selectionEnd = pos;
            });
        }
    }, [onChange, onRun]);

    // Active-line highlight top offset (absolute-positioned behind textarea)
    const activeLineTop = PT + (cursorLine - 1) * LINE;

    return (
        <div
            className="code-editor-root flex flex-col flex-1 min-h-0 overflow-hidden"
            style={{ fontFamily: 'var(--font-mono)' }}
        >
            {/* ── Viewport ─────────────────────────────────────────────────────── */}
            <div className="flex flex-1 min-h-0 overflow-hidden">

                {/* Line-number gutter */}
                <div
                    ref={gutterRef}
                    className="ce-gutter shrink-0 select-none"
                    style={{ width: gutterW, paddingTop: PT, overflowY: 'hidden', overflowX: 'hidden' }}
                    aria-hidden="true"
                >
                    {lines.map((_, idx) => (
                        <div
                            key={idx}
                            className={`ce-line-num ${idx + 1 === cursorLine ? 'ce-line-num--active' : ''}`}
                            style={{ height: LINE, lineHeight: `${LINE}px` }}
                        >
                            {idx + 1}
                        </div>
                    ))}
                </div>

                {/* ── Code pane ──────────────────────────────────────────────────── */}
                <div className="relative flex-1 overflow-hidden">

                    {/* Active-line band — positioned by JS, pixel-perfect */}
                    <div
                        aria-hidden="true"
                        style={{
                            position: 'absolute',
                            left: 0, right: 0,
                            top: activeLineTop,
                            height: LINE,
                            background: 'rgba(124, 106, 238, 0.09)',
                            pointerEvents: 'none',
                            borderLeft: '2px solid rgba(124,106,238,0.5)',
                        }}
                    />

                    {/* ① Syntax-highlight layer — IDENTICAL metrics to textarea ── */}
                    <pre
                        ref={hlRef}
                        aria-hidden="true"
                        style={{
                            ...SHARED_STYLE,
                            overflow: 'hidden',    // no scrollbars → no size difference
                            color: 'transparent',  // base colour is transparent, spans override
                            pointerEvents: 'none',
                        }}
                    >
                        {lines.map((line, idx) => (
                            <span key={idx}>
                                {line.length === 0
                                    ? ' '   // non-breaking space preserves line height
                                    : highlightLine(line).map((s, i) => (
                                        <span key={i} className={s.cls}>{s.text}</span>
                                    ))
                                }
                                {'\n'}
                            </span>
                        ))}
                    </pre>

                    {/* ② Textarea — transparent text, visible caret ─────────────── */}
                    <textarea
                        ref={textareaRef}
                        value={value}
                        onChange={e => onChange(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onClick={updateCursor}
                        onKeyUp={updateCursor}
                        onSelect={updateCursor}
                        spellCheck={false}
                        autoCorrect="off"
                        autoCapitalize="off"
                        style={{
                            ...SHARED_STYLE,
                            color: 'transparent',
                            caretColor: '#a78bfa',
                            resize: 'none',
                            overflowX: 'auto',
                            overflowY: 'auto',
                        }}
                    />
                </div>
            </div>

            {/* ── Status bar ───────────────────────────────────────────────────── */}
            <div className="ce-statusbar flex items-center justify-between px-4 py-1.5 text-[10px] select-none shrink-0">
                <div className="flex items-center gap-3 text-zinc-600">
                    <span className="text-zinc-500">{lineCount} línea{lineCount !== 1 ? 's' : ''}</span>
                    <span className="opacity-40">·</span>
                    <span>{value.length} chars</span>
                </div>
                <div className="flex items-center gap-3 text-zinc-600">
                    <span>
                        Ln <span className="text-zinc-400">{cursorLine}</span>,{' '}
                        Col <span className="text-zinc-400">{cursorCol}</span>
                    </span>
                    <span className="opacity-40">·</span>
                    <span className="text-indigo-500">MiniTS</span>
                </div>
            </div>
        </div>
    );
}
