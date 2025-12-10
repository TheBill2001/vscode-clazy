import {
    commands,
    ExtensionContext,
    languages,
    TextDocument,
    window,
    workspace,
} from "vscode";

import Log from "./log";
import Lint from "./lint";
import Config from "./config";
import ClazyRefactorActionProvider from "./action";

function documentIsLocal(document: TextDocument) {
    return document.uri.scheme === "file";
}

function documentIsCpp(document: TextDocument) {
    return document.languageId === "cpp";
}

function documentCanBeLint(document: TextDocument) {
    return (
        !document.isDirty &&
        workspace.getWorkspaceFolder(document.uri) &&
        documentIsLocal(document) &&
        documentIsCpp(document)
    );
}

export function activate(context: ExtensionContext) {
    context.subscriptions.push(
        Log.channel,
        Lint.diagnosticCollection,
        commands.registerCommand("clazy.lintFile", async () => {
            // Lint active open file
            if (window.activeTextEditor === undefined) {
                return;
            }

            const document = window.activeTextEditor.document;
            if (!documentIsLocal(document)) {
                Log.error(
                    `Document is not a local file: ${document.uri.toString()}`,
                );
                window.showErrorMessage("Document is not a local file.");
                return;
            }

            if (!documentIsCpp(document)) {
                Log.error(
                    `Document is not a C++ document: ${document.uri.toString()}`,
                );
                window.showErrorMessage("Document is not a C++ document.");
                return;
            }

            if (await document.save()) {
                Lint.lintDocument(document);
            }
        }),
        commands.registerCommand("clazy.lintOpenFiles", () => {
            // Lint all open files.
            for (const document of workspace.textDocuments) {
                if (documentIsLocal(document) && documentIsCpp(document)) {
                    document.save().then((ret) => {
                        if (ret) {
                            Lint.lintDocument(document);
                        }
                    });
                }
            }
        }),
        commands.registerCommand("clazy.private.onFixApplied", async (uri) => {
            // Remove diagnostic after fix is applied
            await workspace.save(uri);
            Lint.removeDiagnosticForUri(uri);
        }),
        languages.registerCodeActionsProvider(
            "cpp",
            new ClazyRefactorActionProvider(),
            {
                providedCodeActionKinds: [ClazyRefactorActionProvider.type],
            },
        ),
        workspace.onDidOpenTextDocument((document) => {
            // Lint document on opened
            if (documentCanBeLint(document)) {
                Lint.lintDocument(document);
            }
        }),
        workspace.onDidChangeConfiguration((config) => {
            // Lint documents after configuration changes
            if (config.affectsConfiguration("clazy")) {
                for (const document of workspace.textDocuments) {
                    if (documentCanBeLint(document)) {
                        Lint.lintDocument(document);
                    }
                }
            }
        }),
        workspace.onDidCloseTextDocument((document) => {
            // Remove diagnostic of closed document
            // NOTE: Should this be configurable?
            Lint.removeDiagnosticForUri(document.uri);
        }),
        workspace.onDidSaveTextDocument((document) => {
            if (Config.lintOnSave && documentCanBeLint(document)) {
                Lint.lintDocument(document);
            }
        }),
    );

    Log.info("Clazy activated.");

    // Lint already opened and saved documents
    for (const document of workspace.textDocuments) {
        if (documentCanBeLint(document)) {
            Lint.lintDocument(document);
        }
    }
}

export function deactivate() {}
