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

function createAction(
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
                document.positionAt(replacement.offset + replacement.length),
            ),
            replacement.replacementText,
        );
    }

    return {
        title: `[Clazy] ${diagnostic.message}`,
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

export default class ClazyRefactorActionProvider implements CodeActionProvider {
    static type = CodeActionKind.QuickFix;
    static #actions = new Map<Diagnostic, ClazyReplacement[]>();

    provideCodeActions(
        document: TextDocument,
        _range: Range | Selection,
        context: CodeActionContext,
        _token: CancellationToken,
    ): ProviderResult<(CodeAction | Command)[]> {
        return context.diagnostics.reduce((actions, diagnostic) => {
            const replacements =
                ClazyRefactorActionProvider.#actions.get(diagnostic);
            if (!replacements) {
                return actions;
            }
            const action = createAction(document, diagnostic, replacements);
            if (action) {
                actions.push(action);
            }
            return actions;
        }, [] as CodeAction[]);
    }

    static addDiagnostic(
        diagnostic: Diagnostic,
        replacements: ClazyReplacement[],
    ) {
        this.#actions.set(diagnostic, replacements);
    }

    static removeDiagnostic(diagnostic: Diagnostic) {
        this.#actions.delete(diagnostic);
    }
}
