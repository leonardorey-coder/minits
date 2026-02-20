import type { Program, Statement, Expression } from './parser';

export function compileToJavaScript(ast: Program): string {
    let jsCode = `// Generated JavaScript from MiniTS\n`;
    jsCode += `const print = __env.print;\n`;
    jsCode += `const read = __env.read;\n\n`;

    // Variables section
    ast.vars.forEach(v => {
        jsCode += `let ${v.identifier};\n`;
    });

    jsCode += '\n';

    // Body
    ast.body.forEach(stmt => {
        jsCode += generateStatement(stmt, 0);
    });

    return jsCode;
}

function generateStatement(stmt: Statement, indentLevel: number): string {
    const indent = ' '.repeat(indentLevel);

    switch (stmt.type) {
        case 'Assignment':
            return `${indent}${stmt.identifier} = ${generateExpression(stmt.value)};\n`;

        case 'Print':
            return `${indent}print(${generateExpression(stmt.value)});\n`;

        case 'Read':
            // Since read takes input from user, it must be asynchronous
            return `${indent}${stmt.identifier} = await read("${stmt.identifier}");\n`;

        case 'IfStatement': {
            let code = `${indent}if (${generateExpression(stmt.condition)}) {\n`;
            stmt.thenBranch.forEach(s => {
                code += generateStatement(s, indentLevel + 2);
            });
            code += `${indent}}\n`;

            if (stmt.elseBranch && stmt.elseBranch.length > 0) {
                code = code.trim() + ` else {\n`;
                stmt.elseBranch.forEach(s => {
                    code += generateStatement(s, indentLevel + 2);
                });
                code += `${indent}}\n`;
            }
            return code;
        }

        case 'WhileStatement': {
            let code = `${indent}while (${generateExpression(stmt.condition)}) {\n`;
            stmt.body.forEach(s => {
                code += generateStatement(s, indentLevel + 2);
            });
            code += `${indent}}\n`;
            return code;
        }

        case 'ForStatement': {
            const initCode = stmt.init.type === 'VarDecl'
                ? `let ${stmt.init.identifier} = 0` // Note: For loops in this grammar hardcode let i: number = 0; we simplified it. We can just say let i = 0 for JS.
                : `${(stmt.init as any).identifier} = ${generateExpression((stmt.init as any).value)}`;

            const updateCode = `${stmt.update.identifier} = ${generateExpression(stmt.update.value)}`;

            let code = `${indent}for (${initCode}; ${generateExpression(stmt.condition)}; ${updateCode}) {\n`;
            stmt.body.forEach(s => {
                code += generateStatement(s, indentLevel + 2);
            });
            code += `${indent}}\n`;
            return code;
        }
    }

    return '';
}

function generateExpression(expr: Expression): string {
    switch (expr.type) {
        case 'Literal':
            if (expr.valueType === 'string') {
                return `"${expr.value}"`;
            }
            return expr.value.toString();
        case 'Identifier':
            return expr.name;
        case 'BinaryExpr':
            return `${generateExpression(expr.left)} ${expr.operator} ${generateExpression(expr.right)}`;
    }
    return '';
}
