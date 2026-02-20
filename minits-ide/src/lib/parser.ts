import { TokenType, type Token } from './lexer';

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
}

export type Statement = Assignment | Print | Read | IfStatement | WhileStatement | ForStatement | BlockStatement;

export interface Assignment {
    type: 'Assignment';
    identifier: string;
    value: Expression;
}

export interface Print {
    type: 'Print';
    value: Expression;
}

export interface Read {
    type: 'Read';
    identifier: string;
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
    init: Assignment | VarDecl; // MiniTS doc shows: for (let i: number = 0; ...)
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
}

export interface Literal {
    type: 'Literal';
    value: any;
    valueType: 'number' | 'string' | 'boolean';
}

export interface Identifier {
    type: 'Identifier';
    name: string;
}

export class ParserError extends Error {
    public token: Token;
    constructor(message: string, token: Token) {
        super(`${message} at line ${token.line}, column ${token.column}`);
        this.token = token;
    }
}

export function parse(tokens: Token[]): Program {
    let current = 0;

    function peek(): Token {
        return tokens[current];
    }

    function advance(): Token {
        return tokens[current++];
    }

    // unused matchType removed

    function matchValue(type: TokenType, value: string): boolean {
        if (peek().type === type && peek().value === value) {
            advance();
            return true;
        }
        return false;
    }

    function expectValue(type: TokenType, value: string): Token {
        const token = peek();
        if (token.type === type && token.value === value) {
            return advance();
        }
        throw new ParserError(`Expected '${value}' but found '${token.value}'`, token);
    }

    function expectType(type: TokenType): Token {
        const token = peek();
        if (token.type === type) {
            return advance();
        }
        throw new ParserError(`Expected token type ${type} but found ${token.type} (${token.value})`, token);
    }

    function parseProgram(): Program {
        expectValue(TokenType.Keyword, 'program');
        expectValue(TokenType.Keyword, 'inicio');

        const vars = parseVars();
        const body = parseMain();

        expectValue(TokenType.Keyword, 'program');
        expectValue(TokenType.Keyword, 'fin');

        return { type: 'Program', vars, body };
    }

    function parseVars(): VarDecl[] {
        const declarations: VarDecl[] = [];
        if (matchValue(TokenType.Keyword, 'vars')) {
            expectValue(TokenType.Punctuation, '{');
            while (peek().type !== TokenType.Punctuation || peek().value !== '}') {
                declarations.push(parseVarDecl());
            }
            expectValue(TokenType.Punctuation, '}');
        }
        return declarations;
    }

    function parseVarDecl(): VarDecl {
        expectValue(TokenType.Keyword, 'let');
        const id = expectType(TokenType.Identifier).value;
        expectValue(TokenType.Punctuation, ':');
        const varType = expectType(TokenType.Keyword).value;
        if (!['number', 'string', 'boolean'].includes(varType)) {
            throw new ParserError(`Unknown variable type '${varType}'`, tokens[current - 1]);
        }

        // Some loops declare vars with assignment directly like "let i: number = 0;"
        // For standard vars block, it should end with ;
        if (matchValue(TokenType.Operator, '=')) {
            // In vars block, assignment is not standard per doc, but let's just consume it if needed
            parseExpression(); // evaluate, but throw away in vars basically
        }
        expectValue(TokenType.Punctuation, ';');
        return { type: 'VarDecl', identifier: id, varType };
    }

    function parseMain(): Statement[] {
        let statements: Statement[] = [];
        if (matchValue(TokenType.Keyword, 'main')) {
            expectValue(TokenType.Punctuation, '{');
            while (peek().type !== TokenType.Punctuation || peek().value !== '}') {
                statements.push(parseStatement());
            }
            expectValue(TokenType.Punctuation, '}');
        }
        return statements;
    }

    function parseStatement(): Statement {
        const token = peek();

        if (token.type === TokenType.Keyword) {
            if (token.value === 'print') return parsePrint();
            if (token.value === 'read') return parseRead();
            if (token.value === 'if') return parseIf();
            if (token.value === 'while') return parseWhile();
            if (token.value === 'for') return parseFor();
            if (token.value === 'let') {
                // Some blocks might allow local var decls, specially in For loop init, but standard shows it in vars. We'll handle For loop specifically.
                throw new ParserError(`Unexpected var declaration outside variables block`, token);
            }
        }

        if (token.type === TokenType.Identifier) {
            return parseAssignment();
        }

        throw new ParserError(`Unexpected statement starting with '${token.value}'`, token);
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
        expectValue(TokenType.Keyword, 'read');
        expectValue(TokenType.Punctuation, '(');
        const id = expectType(TokenType.Identifier).value;
        expectValue(TokenType.Punctuation, ')');
        expectValue(TokenType.Punctuation, ';');
        return { type: 'Read', identifier: id };
    }

    function parseAssignment(): Assignment {
        const id = expectType(TokenType.Identifier).value;
        expectValue(TokenType.Operator, '=');
        const value = parseExpression();
        // Allow assignments without trailing semicolon specifically for For-loop update
        // We check if it is part of a for loop or normal statement
        if (peek().value === ';') {
            expectValue(TokenType.Punctuation, ';');
        }
        return { type: 'Assignment', identifier: id, value };
    }

    function parseIf(): IfStatement {
        expectValue(TokenType.Keyword, 'if');
        expectValue(TokenType.Punctuation, '(');
        const condition = parseExpression();
        expectValue(TokenType.Punctuation, ')');

        expectValue(TokenType.Punctuation, '{');
        const thenBranch: Statement[] = [];
        while (peek().value !== '}') thenBranch.push(parseStatement());
        expectValue(TokenType.Punctuation, '}');

        let elseBranch: Statement[] | undefined;
        if (matchValue(TokenType.Keyword, 'else')) {
            expectValue(TokenType.Punctuation, '{');
            elseBranch = [];
            while (peek().value !== '}') elseBranch.push(parseStatement());
            expectValue(TokenType.Punctuation, '}');
        }

        return { type: 'IfStatement', condition, thenBranch, elseBranch };
    }

    function parseWhile(): WhileStatement {
        expectValue(TokenType.Keyword, 'while');
        expectValue(TokenType.Punctuation, '(');
        const condition = parseExpression();
        expectValue(TokenType.Punctuation, ')');

        expectValue(TokenType.Punctuation, '{');
        const body: Statement[] = [];
        while (peek().value !== '}') body.push(parseStatement());
        expectValue(TokenType.Punctuation, '}');

        return { type: 'WhileStatement', condition, body };
    }

    function parseFor(): ForStatement {
        expectValue(TokenType.Keyword, 'for');
        expectValue(TokenType.Punctuation, '(');

        // Init (could be Let or Assignment)
        let init: VarDecl | Assignment;
        if (peek().value === 'let') {
            expectValue(TokenType.Keyword, 'let');
            const id = expectType(TokenType.Identifier).value;
            expectValue(TokenType.Punctuation, ':');
            const varType = expectType(TokenType.Keyword).value;
            expectValue(TokenType.Operator, '=');
            parseExpression(); // Initial value
            expectValue(TokenType.Punctuation, ';');
            init = { type: 'VarDecl', identifier: id, varType }; // Ignore the value for simplicity since target translates to let JS
        } else {
            init = parseAssignment();
        }

        const condition = parseExpression();
        expectValue(TokenType.Punctuation, ';');

        const update = parseAssignment(); // won't consume semicolon because of logic in parseAssignment
        expectValue(TokenType.Punctuation, ')');

        expectValue(TokenType.Punctuation, '{');
        const body: Statement[] = [];
        while (peek().value !== '}') body.push(parseStatement());
        expectValue(TokenType.Punctuation, '}');

        return { type: 'ForStatement', init, condition, update, body };
    }

    function parseExpression(): Expression {
        return parseComparison();
    }

    function parseComparison(): Expression {
        let left = parseTerm();

        while (['<', '>', '<=', '>=', '==', '!='].includes(peek().value)) {
            const operator = advance().value;
            const right = parseTerm();
            left = { type: 'BinaryExpr', left, operator, right };
        }

        return left;
    }

    function parseTerm(): Expression {
        let left = parseFactor();

        while (['+', '-'].includes(peek().value)) {
            const operator = advance().value;
            const right = parseFactor();
            left = { type: 'BinaryExpr', left, operator, right };
        }

        return left;
    }

    function parseFactor(): Expression {
        let left = parsePrimary();

        while (['*', '/'].includes(peek().value)) {
            const operator = advance().value;
            const right = parsePrimary();
            left = { type: 'BinaryExpr', left, operator, right };
        }

        return left;
    }

    function parsePrimary(): Expression {
        const token = advance();

        if (token.type === TokenType.NumberLiteral) {
            return { type: 'Literal', value: parseFloat(token.value), valueType: 'number' };
        }
        if (token.type === TokenType.StringLiteral) {
            return { type: 'Literal', value: token.value, valueType: 'string' };
        }
        if (token.type === TokenType.BooleanLiteral) {
            return { type: 'Literal', value: token.value === 'true', valueType: 'boolean' };
        }
        if (token.type === TokenType.Identifier) {
            return { type: 'Identifier', name: token.value };
        }
        if (token.type === TokenType.Punctuation && token.value === '(') {
            const expr = parseExpression();
            expectValue(TokenType.Punctuation, ')');
            return expr;
        }

        throw new ParserError(`Unexpected token in expression: ${token.value}`, token);
    }

    return parseProgram();
}
