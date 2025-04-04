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
    static #actions = new Map<Diagnostic, ClazyReplacement[]>();

    provideCodeActions(
        document: TextDocument,
        _range: Range | Selection,
        context: CodeActionContext,
        _token: CancellationToken,
    ): ProviderResult<(CodeAction | Command)[]> {
        return context.diagnostics.reduce((acc, diagnostic) => {
            const replacements =
                ClazyRefactorActionProvider.#actions.get(diagnostic);
            if (!replacements) {
                return acc;
            }
            const action = ClazyRefactorActionProvider.#createAction(
                document,
                diagnostic,
                replacements,
            );
            if (action) {
                acc.push(action);
            }
            return acc;
        }, [] as CodeAction[]);
    }

    static #createAction(
        document: TextDocument,
        diagnostic: Diagnostic,
        replacements: ClazyReplacement[],
    ): CodeAction | undefined {
        if (diagnostic.source !== "clazy") {
            return;
        }

        const changes = new WorkspaceEdit();
        for (const replacement of replacements) {
            changes.replace(
                document.uri,
                new Range(
                    document.positionAt(replacement.offset),
                    document.positionAt(
                        replacement.offset + replacement.length,
                    ),
                ),
                replacement.replacementText,
            );
        }

        return {
            title: `[Clazy] Apply fix`,
            diagnostics: [diagnostic],
            kind: CodeActionKind.QuickFix,
            edit: changes,
            command: {
                title: "Save",
                command: "clazy.private.onFixApplied",
                arguments: [document.uri],
            },
        };
    }

    static add(diagnostic: Diagnostic, replacements: ClazyReplacement[]) {
        this.#actions.set(diagnostic, replacements);
    }

    static remove(diagnostic: Diagnostic) {
        this.#actions.delete(diagnostic);
    }
}
