import type { Program, Statement, Expression } from './parser';
import type { CompilationError } from './errors';

export interface SymbolInfo {
    name: string;
    type: string;
    line: number;
    column: number;
    isInitialized: boolean;
    usageCount: number;
}

export function analyze(ast: Program): { errors: CompilationError[]; symbols: SymbolInfo[] } {
    const errors: CompilationError[] = [];
    const symbolMap = new Map<string, { type: string, line: number, column: number, isInitialized: boolean, usageCount: number }>();

    function reportSemanticError(message: string, line: number, column: number) {
        errors.push({ message, line, column, source: 'semantic' });
    }

    // 1. Check declarations
    ast.vars.forEach((v) => {
        if (symbolMap.has(v.identifier)) {
            reportSemanticError(`Variable '${v.identifier}' ya fue declarada previamente`, v.line, v.column);
        } else {
            let isInitialized = false;
            if (v.value) {
                const exprType = checkExpression(v.value);
                if (exprType && exprType !== v.varType) {
                    reportSemanticError(`No se puede inicializar la variable '${v.identifier}' de tipo '${v.varType}' con un valor de tipo '${exprType}'`, v.line, v.column);
                }
                isInitialized = true;
            }
            symbolMap.set(v.identifier, { type: v.varType, line: v.line, column: v.column, isInitialized, usageCount: 0 });
        }
    });

    // 2. Check statements deeply
    function checkStatement(stmt: Statement) {
        switch (stmt.type) {
            case 'Assignment':
                if (!symbolMap.has(stmt.identifier)) {
                    reportSemanticError(`Variable '${stmt.identifier}' no declarada`, stmt.line, stmt.column);
                } else {
                    const symbol = symbolMap.get(stmt.identifier)!;
                    const expectedType = symbol.type;
                    const exprType = checkExpression(stmt.value);
                    if (exprType && expectedType && exprType !== expectedType) {
                        reportSemanticError(`No se puede asignar un valor de tipo '${exprType}' a la variable '${stmt.identifier}' de tipo '${expectedType}'`, stmt.line, stmt.column);
                    }
                    symbol.isInitialized = true;
                }
                break;
            case 'Read':
                if (!symbolMap.has(stmt.identifier)) {
                    reportSemanticError(`Variable '${stmt.identifier}' no declarada para leer`, stmt.line, stmt.column);
                } else {
                    const symbol = symbolMap.get(stmt.identifier)!;
                    symbol.isInitialized = true;
                }
                break;
            case 'Print':
                checkExpression(stmt.value);
                break;
            case 'IfStatement':
                checkAssertionType(stmt.condition, 'boolean', "La condición del 'if' debe ser boolean");
                stmt.thenBranch.forEach(checkStatement);
                stmt.elseBranch?.forEach(checkStatement);
                break;
            case 'WhileStatement':
                checkAssertionType(stmt.condition, 'boolean', "La condición del 'while' debe ser boolean");
                stmt.body.forEach(checkStatement);
                break;
            case 'ForStatement':
                if (stmt.init.type === 'VarDecl') {
                    // Temporarily add for-loop variable (Note: standard Minits doesn't have block scope, but we map it)
                    if (symbolMap.has(stmt.init.identifier)) {
                        reportSemanticError(`Variable de bucle for '${stmt.init.identifier}' opaca otra variable existente`, stmt.init.line, stmt.init.column);
                    }
                    let isInitialized = false;
                    if (stmt.init.value) {
                        const exprType = checkExpression(stmt.init.value);
                        if (exprType && exprType !== stmt.init.varType) {
                            reportSemanticError(`No se puede inicializar la variable '${stmt.init.identifier}' de tipo '${stmt.init.varType}' con un valor de tipo '${exprType}'`, stmt.init.line, stmt.init.column);
                        }
                        isInitialized = true;
                    }
                    symbolMap.set(stmt.init.identifier, { type: stmt.init.varType, line: stmt.init.line, column: stmt.init.column, isInitialized, usageCount: 0 });
                } else {
                    checkStatement(stmt.init);
                }

                checkAssertionType(stmt.condition, 'boolean', "La condición del 'for' debe ser boolean");
                checkStatement(stmt.update);
                stmt.body.forEach(checkStatement);

                if (stmt.init.type === 'VarDecl') {
                    // Cleanup loop var after body
                    symbolMap.delete(stmt.init.identifier);
                }
                break;
            case 'BlockStatement':
                stmt.body.forEach(checkStatement);
                break;
        }
    }

    function checkAssertionType(expr: Expression, expected: string, errorMsg: string) {
        const type = checkExpression(expr);
        if (type && type !== expected) {
            // Find line/col of expr if possible, fallback to roughly where it might be
            const line = ('line' in expr) ? (expr as any).line : 1;
            const column = ('column' in expr) ? (expr as any).column : 1;
            reportSemanticError(`${errorMsg}. Se encontró '${type}'`, line, column);
        }
    }

    function checkExpression(expr: Expression): string | null {
        switch (expr.type) {
            case 'Literal':
                return expr.valueType; // 'number', 'string', 'boolean'
            case 'Identifier':
                if (!symbolMap.has(expr.name)) {
                    reportSemanticError(`Variable '${expr.name}' no declarada`, expr.line, expr.column);
                    return null;
                }
                const symbol = symbolMap.get(expr.name)!;
                if (!symbol.isInitialized) {
                    reportSemanticError(`Variable '${expr.name}' podría no estar inicializada al usarse`, expr.line, expr.column);
                }
                symbol.usageCount++;
                return symbol.type;
            case 'BinaryExpr':
                const leftType = checkExpression(expr.left);
                const rightType = checkExpression(expr.right);

                // Arithmetic operations
                if (['+', '-', '*', '/'].includes(expr.operator)) {
                    if (expr.operator === '+') {
                        if (leftType === 'string' && rightType === 'string') return 'string';
                        if (leftType === 'number' && rightType === 'number') return 'number';
                        if (leftType && rightType) {
                            reportSemanticError(`El operador '+' solo soporta operandos del mismo tipo (number o string), se encontraron '${leftType}' y '${rightType}'`, expr.line, expr.column);
                        }
                        return null; // Return null on type mismatch
                    }

                    if (leftType !== 'number' || rightType !== 'number') {
                        if (leftType && rightType) {
                            reportSemanticError(`Operador aritmético '${expr.operator}' no soportado entre '${leftType}' y '${rightType}'. Se esperaban números.`, expr.line, expr.column);
                        }
                        return null;
                    }
                    return 'number';
                }

                // Comparison operations
                if (['<', '>', '<=', '>=', '==', '!='].includes(expr.operator)) {
                    if (leftType && rightType && leftType !== rightType) {
                        reportSemanticError(`No se pueden comparar tipos distintos ('${leftType}' con '${rightType}')`, expr.line, expr.column);
                    }
                    if (['<', '>', '<=', '>='].includes(expr.operator) && leftType && leftType !== 'number') {
                        reportSemanticError(`El operador '${expr.operator}' solo soporta comparación de números`, expr.line, expr.column);
                    }
                    return 'boolean';
                }

                return null;
        }
    }

    ast.body.forEach(checkStatement);

    // 3. Check unused variables
    symbolMap.forEach((info, identifier) => {
        if (info.usageCount === 0) {
            reportSemanticError(`Variable '${identifier}' declarada pero nunca usada`, info.line, info.column);
        }
    });

    return {
        errors,
        symbols: Array.from(symbolMap.entries()).map(([name, info]) => ({ name, ...info }))
    };
}
