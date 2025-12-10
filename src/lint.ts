import {
    Diagnostic,
    DiagnosticRelatedInformation,
    languages,
    Location,
    Position,
    Range,
    TextDocument,
    Uri,
    workspace,
} from "vscode";
import Log from "./log";
import { ClazyDiagnostic, ClazyReplacement, runClazy } from "./clazy";
import ClazyRefactorActionProvider from "./action";

function makeVSCodeDiagnostics(
    document: TextDocument,
    clazyDiagnostic: ClazyDiagnostic,
): [Diagnostic, ClazyReplacement[]] {
    const diagnosticName = clazyDiagnostic.diagnosticName.startsWith("clazy-")
        ? clazyDiagnostic.diagnosticName.slice(6)
        : clazyDiagnostic.diagnosticName;
    const diagnosticMessage = clazyDiagnostic.diagnosticMessage;
    const diagnosticCode = {
        value: diagnosticName,
        target: Uri.parse(
            `https://github.com/KDE/clazy/tree/master/docs/checks/README-${diagnosticName}.md`,
        ),
    };

    let diagnostic: Diagnostic;
    if (diagnosticMessage.replacements.length > 0) {
        const beginPos = document.positionAt(
            diagnosticMessage.replacements[0].offset,
        );
        const endPos = document.positionAt(
            Math.max(
                ...diagnosticMessage.replacements.map(
                    (e) => e.offset + e.length,
                ),
            ),
        );

        diagnostic = new Diagnostic(
            new Range(beginPos, endPos),
            diagnosticMessage.message,
            diagnosticMessage.severity,
        );
    } else {
        diagnostic = new Diagnostic(
            new Range(
                diagnosticMessage.row!,
                diagnosticMessage.column!,
                diagnosticMessage.row!,
                diagnosticMessage.column! + 1,
            ),
            diagnosticMessage.message,
            diagnosticMessage.severity,
        );
    }

    if (clazyDiagnostic.relatedInformation) {
        diagnostic.relatedInformation = clazyDiagnostic.relatedInformation.map(
            (item) =>
                new DiagnosticRelatedInformation(
                    new Location(
                        Uri.file(item.filePath),
                        new Position(item.row, item.column),
                    ),
                    item.message,
                ),
        );
    }

    diagnostic.source = "clazy";
    diagnostic.code = diagnosticCode;
    diagnostic.message = diagnosticMessage.message;

    return [diagnostic, diagnosticMessage.replacements];
}

// Clazy use 1-based indexing while VSCode use 0-based indexing
function fixDiagnosticRanges(
    diagnostics: ClazyDiagnostic[],
    document: TextDocument,
) {
    const buffer = Buffer.from(document.getText());

    diagnostics.forEach((diagnostic) => {
        if (diagnostic.diagnosticMessage.fileOffset !== undefined) {
            diagnostic.diagnosticMessage.fileOffset = buffer
                .subarray(0, diagnostic.diagnosticMessage.fileOffset)
                .toString().length;

            const position = document.positionAt(
                diagnostic.diagnosticMessage.fileOffset,
            );
            diagnostic.diagnosticMessage.row = position.line;
            diagnostic.diagnosticMessage.column = position.character;
        } else if (
            diagnostic.diagnosticMessage.row !== undefined &&
            diagnostic.diagnosticMessage.column !== undefined
        ) {
            diagnostic.diagnosticMessage.row--;
            diagnostic.diagnosticMessage.column--;
            diagnostic.diagnosticMessage.fileOffset = document.offsetAt(
                new Position(
                    diagnostic.diagnosticMessage.row,
                    diagnostic.diagnosticMessage.column,
                ),
            );
        }

        diagnostic.relatedInformation?.forEach((item) => {
            item.row--;
            item.column--;
        });

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
    static readonly #diagnosticCollection =
        languages.createDiagnosticCollection("Clazy");

    static get diagnosticCollection() {
        return this.#diagnosticCollection;
    }

    static lintDocument(document: TextDocument) {
        Log.info(`Linting document: ${document.uri.toString()}`);

        runClazy(document.uri.fsPath)
            ?.then(
                (
                    clazyDiagnostics,
                ): Map<Diagnostic, ClazyReplacement[]> | undefined => {
                    if (clazyDiagnostics.length <= 0) {
                        return;
                    }

                    const fixClazyDiagnostics = fixDiagnosticRanges(
                        clazyDiagnostics,
                        document,
                    );

                    // Dedup
                    for (
                        let index1 = 0;
                        index1 < clazyDiagnostics.length;
                        ++index1
                    ) {
                        const d1 = clazyDiagnostics[index1];
                        for (
                            let index2 = index1 + 1;
                            index2 < clazyDiagnostics.length;
                        ) {
                            const d2 = clazyDiagnostics[index2];

                            if (
                                d1.diagnosticName !== d2.diagnosticName ||
                                d1.diagnosticMessage.message !==
                                    d2.diagnosticMessage.message ||
                                d1.diagnosticMessage.filePath !==
                                    d2.diagnosticMessage.filePath ||
                                d1.diagnosticMessage.severity !==
                                    d2.diagnosticMessage.severity ||
                                d1.diagnosticMessage.fileOffset !==
                                    d2.diagnosticMessage.fileOffset ||
                                d1.diagnosticMessage.row !==
                                    d2.diagnosticMessage.row ||
                                d1.diagnosticMessage.column !==
                                    d2.diagnosticMessage.column
                            ) {
                                ++index2;
                                continue;
                            }

                            if (
                                d1.diagnosticMessage.replacements.length <
                                d2.diagnosticMessage.replacements.length
                            ) {
                                d1.diagnosticMessage.replacements =
                                    d2.diagnosticMessage.replacements;
                            }

                            if (
                                d1.relatedInformation !==
                                    d2.relatedInformation &&
                                !d1.relatedInformation
                            ) {
                                d1.relatedInformation = d2.relatedInformation;
                            }

                            clazyDiagnostics.splice(index2, 1);
                        }
                    }

                    const diagnostics = new Map<
                        Diagnostic,
                        ClazyReplacement[]
                    >();
                    for (const clazyDiagnostic of fixClazyDiagnostics) {
                        if (
                            workspace.asRelativePath(document.fileName) ===
                            workspace.asRelativePath(
                                clazyDiagnostic.diagnosticMessage.filePath,
                            )
                        ) {
                            const [diagnostic, replacements] =
                                makeVSCodeDiagnostics(
                                    document,
                                    clazyDiagnostic,
                                );
                            diagnostics.set(diagnostic, replacements);
                        }
                    }
                    return diagnostics;
                },
            )
            .then((diagnostics) => {
                Lint.removeDiagnosticForUri(document.uri);

                if (diagnostics) {
                    for (const [diagnostic, replacements] of diagnostics) {
                        if (replacements.length > 0) {
                            ClazyRefactorActionProvider.addDiagnostic(
                                diagnostic,
                                replacements,
                            );
                        }
                    }

                    this.#diagnosticCollection.set(
                        document.uri,
                        Array.from(diagnostics.keys()),
                    );
                }
            });
    }

    static removeDiagnosticForUri(uri: Uri) {
        this.#diagnosticCollection
            .get(uri)
            ?.forEach((diagnostic) =>
                ClazyRefactorActionProvider.removeDiagnostic(diagnostic),
            );
        this.#diagnosticCollection.delete(uri);
    }
}
