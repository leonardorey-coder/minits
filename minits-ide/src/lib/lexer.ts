export const TokenType = {
    Keyword: "Keyword",
    Identifier: "Identifier",
    NumberLiteral: "NumberLiteral",
    StringLiteral: "StringLiteral",
    BooleanLiteral: "BooleanLiteral",
    Operator: "Operator",
    Punctuation: "Punctuation",
    EOF: "EOF",
} as const;

export type TokenType = typeof TokenType[keyof typeof TokenType];

export interface Token {
    type: TokenType;
    value: string;
    line: number;
    column: number;
}

const KEYWORDS = new Set([
    'program', 'inicio', 'fin', 'vars', 'main',
    'let', 'number', 'string', 'boolean',
    'read', 'print', 'if', 'else', 'while', 'for'
]);

const BOOLEANS = new Set(['true', 'false']);

export function tokenize(sourceCode: string): Token[] {
    const tokens: Token[] = [];
    let current = 0;
    let line = 1;
    let column = 1;

    while (current < sourceCode.length) {
        let char = sourceCode[current];

        // Skip whitespace
        if (/\s/.test(char)) {
            if (char === '\n') {
                line++;
                column = 1;
            } else {
                column++;
            }
            current++;
            continue;
        }

        // Skip comments
        if (char === '/' && sourceCode[current + 1] === '/') {
            while (current < sourceCode.length && sourceCode[current] !== '\n') {
                current++;
            }
            continue;
        }

        // Punctuation
        if (/[{};():,]/.test(char)) {
            tokens.push({ type: TokenType.Punctuation, value: char, line, column });
            current++;
            column++;
            continue;
        }

        // Operators
        if (/[=<>!+\-*/]/.test(char)) {
            let value = char;
            const nextChar = sourceCode[current + 1];
            if ((char === '=' || char === '<' || char === '>' || char === '!') && nextChar === '=') {
                value += '=';
                current++;
            }
            tokens.push({ type: TokenType.Operator, value, line, column });
            current++;
            column += value.length;
            continue;
        }

        // String literals
        if (char === '"' || char === "'") {
            const quoteType = char;
            let value = '';
            const startCol = column;
            current++;
            column++;

            while (current < sourceCode.length && sourceCode[current] !== quoteType) {
                value += sourceCode[current];
                current++;
                column++;
            }

            if (sourceCode[current] === quoteType) {
                current++; // skip closing quote
                column++;
            }

            tokens.push({ type: TokenType.StringLiteral, value, line, column: startCol });
            continue;
        }

        // Number literals
        if (/[0-9]/.test(char)) {
            let value = '';
            const startCol = column;
            while (current < sourceCode.length && /[0-9.]/.test(sourceCode[current])) {
                value += sourceCode[current];
                current++;
                column++;
            }
            tokens.push({ type: TokenType.NumberLiteral, value, line, column: startCol });
            continue;
        }

        // Identifiers and Keywords
        if (/[a-zA-Z_]/.test(char)) {
            let value = '';
            const startCol = column;
            while (current < sourceCode.length && /[a-zA-Z0-9_]/.test(sourceCode[current])) {
                value += sourceCode[current];
                current++;
                column++;
            }

            if (KEYWORDS.has(value)) {
                tokens.push({ type: TokenType.Keyword, value, line, column: startCol });
            } else if (BOOLEANS.has(value)) {
                tokens.push({ type: TokenType.BooleanLiteral, value, line, column: startCol });
            } else {
                tokens.push({ type: TokenType.Identifier, value, line, column: startCol });
            }
            continue;
        }

        // Unknown char
        throw new Error(`Unexpected character '${char}' at line ${line}, column ${column}`);
    }

    tokens.push({ type: TokenType.EOF, value: '', line, column });
    return tokens;
}
