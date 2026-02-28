import { TokenType, type Token } from './lexer';
import type { CompilationError } from './errors';

export type ASTNode = Program | VarDecl | Statement | Expression;

export interface Program {
    type: 'Program';
    vars: VarDecl[];
    body: Statement[];
}

export interface VarDecl {
    type: 'VarDecl';
    identifier: string;
    varType: string;
    line: number;
    column: number;
}

export type Statement = Assignment | Print | Read | IfStatement | WhileStatement | ForStatement | BlockStatement;

export interface Assignment {
    type: 'Assignment';
    identifier: string;
    value: Expression;
    line: number;
    column: number;
}

export interface Print {
    type: 'Print';
    value: Expression;
}

export interface Read {
    type: 'Read';
    identifier: string;
    line: number;
    column: number;
}

export interface IfStatement {
    type: 'IfStatement';
    condition: Expression;
    thenBranch: Statement[];
    elseBranch?: Statement[];
}

export interface WhileStatement {
    type: 'WhileStatement';
    condition: Expression;
    body: Statement[];
}

export interface ForStatement {
    type: 'ForStatement';
    init: Assignment | VarDecl;
    condition: Expression;
    update: Assignment;
    body: Statement[];
}

export interface BlockStatement {
    type: 'BlockStatement';
    body: Statement[];
}

export type Expression = BinaryExpr | Literal | Identifier;

export interface BinaryExpr {
    type: 'BinaryExpr';
    left: Expression;
    operator: string;
    right: Expression;
    line: number;
    column: number;
}

export interface Literal {
    type: 'Literal';
    value: any;
    valueType: 'number' | 'string' | 'boolean';
    line: number;
    column: number;
}

export interface Identifier {
    type: 'Identifier';
    name: string;
    line: number;
    column: number;
}

export class ParserError extends Error {
    public token: Token;
    constructor(message: string, token: Token) {
        super(message);
        this.token = token;
    }
}

export function parse(tokens: Token[]): { ast: Program | null; errors: CompilationError[] } {
    let current = 0;
    const errors: CompilationError[] = [];

    function reportError(message: string, token: Token) {
        errors.push({
            message,
            line: token.line,
            column: token.column,
            source: 'parser'
        });
    }

    function peek(): Token {
        if (current >= tokens.length) return tokens[tokens.length - 1];
        return tokens[current];
    }

    function previous(): Token {
        return tokens[current - 1];
    }

    function advance(): Token {
        if (peek().type !== TokenType.EOF) current++;
        return previous();
    }

    function checkType(type: TokenType): boolean {
        if (peek().type === TokenType.EOF) return false;
        return peek().type === type;
    }

    function checkValue(type: TokenType, value: string): boolean {
        if (peek().type === TokenType.EOF) return false;
        return peek().type === type && peek().value === value;
    }

    function matchValue(type: TokenType, value: string): boolean {
        if (checkValue(type, value)) {
            advance();
            return true;
        }
        return false;
    }

    function expectValue(type: TokenType, value: string): Token {
        if (checkValue(type, value)) return advance();
        const token = peek();
        throw new ParserError(`Se esperaba '${value}' pero se encontró '${token.value}'`, token);
    }

    function expectType(type: TokenType): Token {
        if (checkType(type)) return advance();
        const token = peek();
        throw new ParserError(`Se esperaba tipo de token ${type} pero se encontró ${token.type} ('${token.value}')`, token);
    }

    function synchronize() {
        advance();
        while (peek().type !== TokenType.EOF) {
            if (previous().value === ';') return;

            switch (peek().value) {
                case 'vars':
                case 'main':
                case 'let':
                case 'if':
                case 'while':
                case 'for':
                case 'print':
                case 'read':
                case 'program':
                case 'inicio':
                case 'fin':
                    return;
            }
            advance();
        }
    }

    function parseProgram(): Program | null {
        try {
            expectValue(TokenType.Keyword, 'program');
            expectValue(TokenType.Keyword, 'inicio');

            const vars = parseVars();
            const body = parseMain();

            expectValue(TokenType.Keyword, 'program');
            expectValue(TokenType.Keyword, 'fin');

            return { type: 'Program', vars, body };
        } catch (e: any) {
            if (e instanceof ParserError) {
                reportError(e.message, e.token);
                // Cannot easily recover top-level structure, but we try
            } else {
                reportError(`Error inesperado: ${e.message}`, peek());
            }
            return null;
        }
    }

    function parseVars(): VarDecl[] {
        const declarations: VarDecl[] = [];
        if (matchValue(TokenType.Keyword, 'vars')) {
            try {
                expectValue(TokenType.Punctuation, '{');
            } catch (e: any) {
                if (e instanceof ParserError) reportError(e.message, e.token);
            }

            while (!checkValue(TokenType.Punctuation, '}') && !checkType(TokenType.EOF) && !checkValue(TokenType.Keyword, 'main')) {
                try {
                    declarations.push(parseVarDecl());
                } catch (e: any) {
                    if (e instanceof ParserError) {
                        reportError(e.message, e.token);
                        synchronize();
                    } else throw e;
                }
            }

            try {
                expectValue(TokenType.Punctuation, '}');
            } catch (e: any) {
                if (e instanceof ParserError) reportError(e.message, e.token);
            }
        }
        return declarations;
    }

    function parseVarDecl(): VarDecl {
        const letToken = expectValue(TokenType.Keyword, 'let');
        const idToken = expectType(TokenType.Identifier);
        expectValue(TokenType.Punctuation, ':');
        const varTypeToken = expectType(TokenType.Keyword);

        if (!['number', 'string', 'boolean'].includes(varTypeToken.value)) {
            throw new ParserError(`Tipo de variable desconocido '${varTypeToken.value}'`, varTypeToken);
        }

        if (matchValue(TokenType.Operator, '=')) {
            parseExpression();
        }
        expectValue(TokenType.Punctuation, ';');
        return {
            type: 'VarDecl',
            identifier: idToken.value,
            varType: varTypeToken.value,
            line: letToken.line,
            column: letToken.column
        };
    }

    function parseMain(): Statement[] {
        let statements: Statement[] = [];
        if (matchValue(TokenType.Keyword, 'main')) {
            try {
                expectValue(TokenType.Punctuation, '{');
            } catch (e: any) {
                if (e instanceof ParserError) reportError(e.message, e.token);
            }

            while (!checkValue(TokenType.Punctuation, '}') && !checkValue(TokenType.Keyword, 'program') && !checkType(TokenType.EOF)) {
                try {
                    const stmt = parseStatement();
                    if (stmt) statements.push(stmt);
                } catch (e: any) {
                    if (e instanceof ParserError) {
                        reportError(e.message, e.token);
                        synchronize();
                    } else throw e;
                }
            }

            try {
                expectValue(TokenType.Punctuation, '}');
            } catch (e: any) {
                if (e instanceof ParserError) reportError(e.message, e.token);
            }
        }
        return statements;
    }

    function parseStatement(): Statement | null {
        const token = peek();

        if (token.type === TokenType.Keyword) {
            if (token.value === 'print') return parsePrint();
            if (token.value === 'read') return parseRead();
            if (token.value === 'if') return parseIf();
            if (token.value === 'while') return parseWhile();
            if (token.value === 'for') return parseFor();
            if (token.value === 'let') {
                throw new ParserError(`Declaración de variable 'let' fuera del bloque 'vars'`, token);
            }
        }

        if (token.type === TokenType.Identifier) {
            // Provide a better error message if the user tried to call an unknown function (like rea(...) instead of read)
            if (current + 1 < tokens.length && tokens[current + 1].value === '(') {
                throw new ParserError(`Llamada a función desconocida o variable usada como función: '${token.value}'`, token);
            }
            return parseAssignment();
        }

        throw new ParserError(`Instrucción inesperada comenzando con '${token.value}'`, token);
    }

    function parseBlock(): Statement[] {
        expectValue(TokenType.Punctuation, '{');
        const stmts: Statement[] = [];
        while (!checkValue(TokenType.Punctuation, '}') && !checkType(TokenType.EOF)) {
            try {
                const stmt = parseStatement();
                if (stmt) stmts.push(stmt);
            } catch (e: any) {
                if (e instanceof ParserError) {
                    reportError(e.message, e.token);
                    synchronize();
                } else throw e;
            }
        }
        expectValue(TokenType.Punctuation, '}');
        return stmts;
    }

    function parsePrint(): Print {
        expectValue(TokenType.Keyword, 'print');
        expectValue(TokenType.Punctuation, '(');
        const value = parseExpression();
        expectValue(TokenType.Punctuation, ')');
        expectValue(TokenType.Punctuation, ';');
        return { type: 'Print', value };
    }

    function parseRead(): Read {
        const readToken = expectValue(TokenType.Keyword, 'read');
        expectValue(TokenType.Punctuation, '(');
        const idToken = expectType(TokenType.Identifier);
        expectValue(TokenType.Punctuation, ')');
        expectValue(TokenType.Punctuation, ';');
        return {
            type: 'Read',
            identifier: idToken.value,
            line: readToken.line,
            column: readToken.column
        };
    }

    function parseAssignment(): Assignment {
        const idToken = expectType(TokenType.Identifier);
        expectValue(TokenType.Operator, '=');
        const value = parseExpression();

        if (peek().value === ';') {
            expectValue(TokenType.Punctuation, ';');
        }
        return {
            type: 'Assignment',
            identifier: idToken.value,
            value,
            line: idToken.line,
            column: idToken.column
        };
    }

    function parseIf(): IfStatement {
        expectValue(TokenType.Keyword, 'if');
        expectValue(TokenType.Punctuation, '(');
        const condition = parseExpression();
        expectValue(TokenType.Punctuation, ')');

        const thenBranch = parseBlock();

        let elseBranch: Statement[] | undefined;
        if (matchValue(TokenType.Keyword, 'else')) {
            elseBranch = parseBlock();
        }

        return { type: 'IfStatement', condition, thenBranch, elseBranch };
    }

    function parseWhile(): WhileStatement {
        expectValue(TokenType.Keyword, 'while');
        expectValue(TokenType.Punctuation, '(');
        const condition = parseExpression();
        expectValue(TokenType.Punctuation, ')');

        const body = parseBlock();

        return { type: 'WhileStatement', condition, body };
    }

    function parseFor(): ForStatement {
        expectValue(TokenType.Keyword, 'for');
        expectValue(TokenType.Punctuation, '(');

        // Init (let or assignment)
        let init: VarDecl | Assignment;
        if (peek().value === 'let') {
            const letToken = expectValue(TokenType.Keyword, 'let');
            const idToken = expectType(TokenType.Identifier);
            expectValue(TokenType.Punctuation, ':');
            const varTypeToken = expectType(TokenType.Keyword);
            expectValue(TokenType.Operator, '=');
            parseExpression();
            expectValue(TokenType.Punctuation, ';');
            init = {
                type: 'VarDecl',
                identifier: idToken.value,
                varType: varTypeToken.value,
                line: letToken.line,
                column: letToken.column
            };
        } else {
            init = parseAssignment();
        }

        const condition = parseExpression();
        expectValue(TokenType.Punctuation, ';');

        const update = parseAssignment();
        expectValue(TokenType.Punctuation, ')');

        const body = parseBlock();

        return { type: 'ForStatement', init, condition, update, body };
    }

    function parseExpression(): Expression {
        return parseComparison();
    }

    function parseComparison(): Expression {
        let left = parseTerm();

        while (['<', '>', '<=', '>=', '==', '!='].includes(peek().value)) {
            const opToken = advance();
            const right = parseTerm();
            left = {
                type: 'BinaryExpr',
                left,
                operator: opToken.value,
                right,
                line: opToken.line,
                column: opToken.column
            };
        }

        return left;
    }

    function parseTerm(): Expression {
        let left = parseFactor();

        while (['+', '-'].includes(peek().value)) {
            const opToken = advance();
            const right = parseFactor();
            left = {
                type: 'BinaryExpr',
                left,
                operator: opToken.value,
                right,
                line: opToken.line,
                column: opToken.column
            };
        }

        return left;
    }

    function parseFactor(): Expression {
        let left = parsePrimary();

        while (['*', '/'].includes(peek().value)) {
            const opToken = advance();
            const right = parsePrimary();
            left = {
                type: 'BinaryExpr',
                left,
                operator: opToken.value,
                right,
                line: opToken.line,
                column: opToken.column
            };
        }

        return left;
    }

    function parsePrimary(): Expression {
        const token = peek();

        if (token.type === TokenType.NumberLiteral) {
            advance();
            return { type: 'Literal', value: parseFloat(token.value), valueType: 'number', line: token.line, column: token.column };
        }
        if (token.type === TokenType.StringLiteral) {
            advance();
            return { type: 'Literal', value: token.value, valueType: 'string', line: token.line, column: token.column };
        }
        if (token.type === TokenType.BooleanLiteral) {
            advance();
            return { type: 'Literal', value: token.value === 'true', valueType: 'boolean', line: token.line, column: token.column };
        }
        if (token.type === TokenType.Identifier) {
            advance();
            return { type: 'Identifier', name: token.value, line: token.line, column: token.column };
        }
        if (token.type === TokenType.Punctuation && token.value === '(') {
            advance();
            const expr = parseExpression();
            expectValue(TokenType.Punctuation, ')');
            return expr;
        }

        throw new ParserError(`Token inesperado en expresión: '${token.value}'`, token);
    }

    const ast = parseProgram();
    return { ast, errors };
}
