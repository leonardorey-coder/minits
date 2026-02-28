export interface CompilationError {
    message: string;
    line: number;
    column: number;
    source?: "lexer" | "parser" | "semantic";
}
