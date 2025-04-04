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

async function makeDiagnostics(
    document: TextDocument,
    diagnostic: ClazyDiagnostic,
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
        const replacements = diagnosticMessage.replacements;

        const beginPos = document.positionAt(replacements[0].offset);
        const endPos = document.positionAt(
            Math.max(...replacements.map((e) => e.offset + e.length)),
        );

        let diagnostic = new Diagnostic(
            new Range(beginPos, endPos),
            diagnosticMessage.message,
            diagnosticMessage.severity,
        );
        diagnostic.source = "clazy";
        diagnostic.code = diagnosticCode;

        ClazyRefactorActionProvider.add(diagnostic, replacements);

        return diagnostic;
    } else {
        const line = document.positionAt(diagnosticMessage.fileOffset).line;
        let diagnostic = new Diagnostic(
            new Range(line, 0, line, Number.MAX_VALUE),
            diagnosticMessage.message,
            diagnosticMessage.severity,
        );
        diagnostic.source = "clazy";
        diagnostic.code = diagnosticCode;
        return diagnostic;
    }
}

async function getDiagnostics(
    diagnostics: ClazyDiagnostic[],
    document: TextDocument,
) {
    const result = diagnostics.reduce(
        async (previousValue, currentValue) => {
            if (
                workspace.asRelativePath(document.fileName) ===
                workspace.asRelativePath(
                    currentValue.diagnosticMessage.filePath,
                )
            ) {
                const diagnostic = await makeDiagnostics(
                    document,
                    currentValue,
                );
                if (diagnostic) {
                    (await previousValue).push(diagnostic);
                }
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

    static async #lintDocument(document: TextDocument) {
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

        const diagnostics = await getDiagnostics(output, document);
        return diagnostics;
    }

    static async lintActiveDocument() {
        if (window.activeTextEditor === undefined) {
            return;
        }

        const document = window.activeTextEditor.document;
        if (await document.save()) {
            const diagnostics = await this.#lintDocument(document);
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
            await this.#lintDocument(document),
        );
    }

    static async lintOpenDocuments() {
        const value = await workspace.saveAll();
        if (value) {
            workspace.textDocuments.forEach((document) =>
                Lint.lintDocument(document),
            );
        }
    }

    static removeDiagnosticForFile(uri: Uri) {
        this.#diagnosticCollection
            .get(uri)
            ?.forEach((value) => ClazyRefactorActionProvider.remove(value));
        this.#diagnosticCollection.delete(uri);
    }
}
