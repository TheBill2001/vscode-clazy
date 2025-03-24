import {
    languages,
    window,
    workspace,
    DiagnosticCollection,
    TextDocument,
    Diagnostic,
    Range,
    Uri,
    WorkspaceEdit,
} from "vscode";

import Clazy, { ClazyDiagnostic, ClazyReplacement, ClazyResult } from "./clazy";
import ClazyRefactorActionProvider from "./action";
import Config from "./config";

async function fix(document: TextDocument, replacements: ClazyReplacement[]) {
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
    await workspace.applyEdit(changes);
    workspace.save(document.uri);
}

async function makeDiagnostics(
    document: TextDocument,
    diagnostic: ClazyDiagnostic,
    fixErrors: boolean,
) {
    const diagnosticName = diagnostic.diagnosticName.startsWith("clazy-")
        ? diagnostic.diagnosticName.slice(6)
        : diagnostic.diagnosticName;
    const diagnosticMessage = diagnostic.diagnosticMessage;
    const diagnosticCode = {
        value: diagnosticName,
        target: Uri.parse(
            `https://github.com/KDE/clazy/tree/master/docs/checks/README-${diagnosticName}.md`,
        ),
    };
    if (diagnosticMessage.replacements.length > 0) {
        if (fixErrors) {
            await fix(document, diagnosticMessage.replacements);
            return [];
        } else {
            return diagnosticMessage.replacements.map((replacement) => {
                const beginPos = document.positionAt(replacement.offset);
                const endPos = document.positionAt(
                    replacement.offset + replacement.length,
                );

                let diagnostic = new Diagnostic(
                    new Range(beginPos, endPos),
                    diagnosticMessage.message,
                    diagnosticMessage.severity,
                );
                diagnostic.source = "clazy";
                diagnostic.code = diagnosticCode;

                ClazyRefactorActionProvider.add(
                    document,
                    diagnostic,
                    replacement,
                );

                return diagnostic;
            });
        }
    } else {
        const line = document.positionAt(diagnosticMessage.fileOffset).line;
        let diagnostic = new Diagnostic(
            new Range(line, 0, line, Number.MAX_VALUE),
            diagnosticMessage.message,
            diagnosticMessage.severity,
        );
        diagnostic.source = "clazy";
        diagnostic.code = diagnosticCode;
        return [diagnostic];
    }
}

async function getDiagnostics(
    diagnostics: ClazyDiagnostic[],
    document: TextDocument,
    fixErrors: boolean,
) {
    const result = diagnostics.reduce(
        async (previousValue, currentValue) => {
            if (
                workspace.asRelativePath(document.fileName) ===
                workspace.asRelativePath(
                    currentValue.diagnosticMessage.filePath,
                )
            ) {
                (
                    await makeDiagnostics(document, currentValue, fixErrors)
                ).forEach(async (element) =>
                    (await previousValue).push(element),
                );
            }
            return previousValue;
        },
        Promise.resolve([] as Diagnostic[]),
    );

    return result;
}

function isBlacklisted(file: TextDocument) {
    const blacklist = Config.blacklist;
    const relativeFilename = workspace.asRelativePath(file.fileName);

    return blacklist.some((entry) => {
        const regex = new RegExp(entry);
        return regex.test(relativeFilename);
    });
}

function fixDiagnosticRanges(
    diagnostics: ClazyDiagnostic[],
    document: TextDocument,
) {
    const buffer = Buffer.from(document.getText());

    diagnostics.forEach((diagnostic) => {
        diagnostic.diagnosticMessage.fileOffset = buffer
            .subarray(0, diagnostic.diagnosticMessage.fileOffset)
            .toString().length;

        diagnostic.diagnosticMessage.replacements.forEach((replacement) => {
            replacement.length = buffer
                .subarray(
                    replacement.offset,
                    replacement.offset + replacement.length,
                )
                .toString().length;

            replacement.offset = buffer
                .subarray(0, replacement.offset)
                .toString().length;
        });
    });

    return diagnostics;
}

export default class Lint {
    static #diagnosticCollection: DiagnosticCollection =
        languages.createDiagnosticCollection();

    static get diagnosticCollection() {
        return this.#diagnosticCollection;
    }

    static async #lintDocument(document: TextDocument, fixErrors: boolean) {
        if (!["cpp", "c"].includes(document.languageId)) {
            return [];
        }

        if (document.uri.scheme !== "file") {
            return [];
        }

        const workspaceFolder = workspace.getWorkspaceFolder(document.uri);
        if (!workspaceFolder) {
            return [];
        }

        if (isBlacklisted(document)) {
            return [];
        }

        const output = fixDiagnosticRanges(
            (await Clazy.run([document.uri.fsPath], workspaceFolder.uri.fsPath))
                .diagnostics,
            document,
        );

        const diagnostics = await getDiagnostics(output, document, fixErrors);
        return diagnostics;
    }

    static async #lintActiveDocument(fixErrors: boolean) {
        if (window.activeTextEditor === undefined) {
            return;
        }

        const document = window.activeTextEditor.document;
        if (await document.save()) {
            const diagnostics = await this.#lintDocument(document, fixErrors);
            if (diagnostics.length > 0) {
                this.#diagnosticCollection.set(document.uri, diagnostics);
            } else {
                if (isBlacklisted(document)) {
                    window.showWarningMessage(
                        `File is blacklisted:\n${document.uri.fsPath}`,
                    );
                }
            }
        }
    }

    static async lintDocument(document: TextDocument) {
        this.#diagnosticCollection.set(
            document.uri,
            await this.#lintDocument(document, Config.fixOnSave),
        );
    }

    static async lintActiveDocument() {
        return this.#lintActiveDocument(Config.fixOnSave);
    }

    static async lintOpenDocuments() {
        const value = await workspace.saveAll();
        if (value) {
            workspace.textDocuments.forEach((document) =>
                Lint.lintDocument(document),
            );
        }
    }

    static async fixActiveDocument() {
        return this.#lintActiveDocument(true);
    }

    // static async fixOpenDocuments() {
    //     const value = await workspace.saveAll();
    //     if (value) {
    //         for (const document of workspace.textDocuments) {
    //             this.#diagnosticCollection.set(
    //                 document.uri,
    //                 await this.#lintDocument(document, true),
    //             );
    //         }
    //     }
    // }

    static removeDiagnosticForFile(uri: Uri) {
        this.#diagnosticCollection
            .get(uri)
            ?.forEach((value) => ClazyRefactorActionProvider.remove(value));
        this.#diagnosticCollection.delete(uri);
    }
}
