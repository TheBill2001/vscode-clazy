import {
    CancellationToken,
    CodeAction,
    CodeActionContext,
    CodeActionKind,
    CodeActionProvider,
    Command,
    Diagnostic,
    ProviderResult,
    Range,
    Selection,
    TextDocument,
    WorkspaceEdit,
} from "vscode";

import { ClazyReplacement } from "./clazy";

export default class ClazyRefactorActionProvider implements CodeActionProvider {
    static type = CodeActionKind.QuickFix;
    static #actions = new Map<Diagnostic, CodeAction>();

    provideCodeActions(
        _document: TextDocument,
        _range: Range | Selection,
        context: CodeActionContext,
        _token: CancellationToken,
    ): ProviderResult<(CodeAction | Command)[]> {
        return context.diagnostics.reduce((acc, diagnostic) => {
            const action = ClazyRefactorActionProvider.#actions.get(diagnostic);
            if (action) {
                acc.push(action);
            }
            return acc;
        }, [] as CodeAction[]);
    }

    static #createAction(
        document: TextDocument,
        diagnostic: Diagnostic,
        replacement: ClazyReplacement,
    ): CodeAction | undefined {
        if (diagnostic.source !== "clazy") {
            return;
        }

        const changes = new WorkspaceEdit();
        changes.replace(
            document.uri,
            new Range(
                document.positionAt(replacement.offset),
                document.positionAt(replacement.offset + replacement.length),
            ),
            replacement.replacementText,
        );

        return {
            title: `[Clazy] Change to ${replacement.replacementText}`,
            diagnostics: [diagnostic],
            kind: CodeActionKind.QuickFix,
            edit: changes,
        };
    }

    static add(
        document: TextDocument,
        diagnostic: Diagnostic,
        replacement: ClazyReplacement,
    ) {
        const action = this.#createAction(document, diagnostic, replacement);
        if (action) {
            this.#actions.set(diagnostic, action);
        }
    }

    static remove(diagnostic: Diagnostic) {
        this.#actions.delete(diagnostic);
    }
}
