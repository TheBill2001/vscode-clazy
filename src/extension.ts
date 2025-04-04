import { commands, workspace, ExtensionContext, languages } from "vscode";

import Utils from "./utils";
import Lint from "./lint";
import Config from "./config";
import ClazyRefactorActionProvider from "./action";

export function activate(context: ExtensionContext) {
    let subscriptions = context.subscriptions;

    subscriptions.push(Lint.diagnosticCollection);
    subscriptions.push(Utils.log);

    subscriptions.push(
        commands.registerCommand("clazy.lintFile", () =>
            Lint.lintActiveDocument(),
        ),
    );

    subscriptions.push(
        commands.registerCommand("clazy.lintOpenFiles", () =>
            Lint.lintOpenDocuments(),
        ),
    );

    subscriptions.push(
        commands.registerCommand("clazy.private.onFixApplied", async (uri) => {
            await workspace.save(uri);
            Lint.removeDiagnosticForFile(uri);
        }),
    );

    context.subscriptions.push(
        languages.registerCodeActionsProvider(
            "cpp",
            new ClazyRefactorActionProvider(),
            {
                providedCodeActionKinds: [ClazyRefactorActionProvider.type],
            },
        ),
    );

    subscriptions.push(
        workspace.onDidSaveTextDocument((document) => {
            if (Config.lintOnSave) {
                Lint.lintDocument(document);
            }
        }),
    );

    subscriptions.push(
        workspace.onDidOpenTextDocument((document) =>
            Lint.lintDocument(document),
        ),
    );

    subscriptions.push(
        workspace.onDidCloseTextDocument((document) =>
            Lint.removeDiagnosticForFile(document.uri),
        ),
    );

    subscriptions.push(
        workspace.onDidChangeConfiguration((config) => {
            if (config.affectsConfiguration("clazy")) {
                workspace.textDocuments.forEach((document) =>
                    Lint.lintDocument(document),
                );
            }
        }),
    );

    Lint.lintOpenDocuments();

    Utils.log.info("Clazy extension activated.");
}

export function deactivate() {}
