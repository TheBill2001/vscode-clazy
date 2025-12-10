import { DiagnosticSeverity, ProgressLocation, window } from "vscode";
import Log from "./log";
import Config from "./config";
import { execFile } from "child_process";
import YAML from "yaml";

export interface ClazyReplacementYaml {
    FilePath: string;
    Offset: number;
    Length: number;
    ReplacementText: string;
}

export interface ClazyDiagnosticMessageYaml {
    Message: string;
    FilePath: string;
    FileOffset: number;
    Replacements: ClazyReplacementYaml[];
}

export interface ClazyDiagnosticYaml {
    DiagnosticName: string;
    DiagnosticMessage: ClazyDiagnosticMessageYaml;
    Level: "Warning" | "Error" | "Info" | "Hint";
}

export interface ClazyYaml {
    MainSourceFile: string;
    Diagnostics: ClazyDiagnosticYaml[];
}

export interface ClazyReplacement {
    filePath: string;
    offset: number;
    length: number;
    replacementText: string;
}

export interface ClazyDiagnosticMessage {
    message: string;
    filePath: string;
    fileOffset?: number;
    row?: number;
    column?: number;
    replacements: ClazyReplacement[];
    severity: DiagnosticSeverity;
}

export interface ClazyDiagnosticRelatedInformation {
    message: string;
    filePath: string;
    row: number;
    column: number;
}

export interface ClazyDiagnostic {
    diagnosticName: string;
    diagnosticMessage: ClazyDiagnosticMessage;
    relatedInformation?: ClazyDiagnosticRelatedInformation[];
}

function parseSeverity(severity: string) {
    switch (severity.toLowerCase()) {
        case "info":
            return DiagnosticSeverity.Information;
        case "error":
            return DiagnosticSeverity.Error;
        case "hint":
            return DiagnosticSeverity.Hint;
        default:
            return DiagnosticSeverity.Warning;
    }
}

function parseClazyStderr(stderr: string): ClazyDiagnostic[] {
    const diagnosticPattern =
        /^(?<filePath>.+):(?<line>\d+):(?<column>\d+): (?<level>\S+): (?<message>.+) \[-W(?<check>\S+)\]/;
    const notePattern =
        /^(?<filePath>.+):(?<line>\d+):(?<column>\d+): note: (?<message>.+)/;
    const endPattern = /^\d+ warnings? generated/;

    const diagnostics: ClazyDiagnostic[] = [];
    const output = stderr.split("\n");
    for (let index = 0; index < output.length; ++index) {
        const string = output.at(index)!;

        if (endPattern.test(string)) {
            break;
        }

        {
            const matches = diagnosticPattern.exec(string);
            if (matches && matches.groups) {
                const { filePath, line, column, level, message, check } =
                    matches.groups;
                diagnostics.push({
                    diagnosticName: check,
                    diagnosticMessage: {
                        message: message.trim(),
                        filePath: filePath,
                        row: parseInt(line),
                        column: parseInt(column),
                        replacements: [],
                        severity: parseSeverity(level),
                    },
                });
            }
        }

        {
            const matches = notePattern.exec(string);
            if (matches && matches.groups) {
                const diagnostic = diagnostics[diagnostics.length - 1];
                const { filePath, line, column, message } = matches.groups;

                if (!diagnostic.relatedInformation) {
                    diagnostic.relatedInformation = [];
                }

                diagnostic.relatedInformation.push({
                    filePath: filePath,
                    message: message,
                    row: parseInt(line),
                    column: parseInt(column),
                });
            }
        }
    }

    return diagnostics;
}

function parseClazyYaml(output: string): ClazyDiagnostic[] {
    const yamlIndex = output.search(/^---$/m);
    if (yamlIndex < 0) {
        return [];
    }

    const yamlDoc = output.substring(yamlIndex);
    const clazyDoc = YAML.parse(yamlDoc) as ClazyYaml;

    return clazyDoc.Diagnostics.map(
        (diagnostic) =>
            ({
                diagnosticName: diagnostic.DiagnosticName,
                diagnosticMessage: {
                    message: diagnostic.DiagnosticMessage.Message,
                    filePath: diagnostic.DiagnosticMessage.FilePath,
                    fileOffset: diagnostic.DiagnosticMessage.FileOffset,
                    severity: parseSeverity(diagnostic.Level),
                    replacements: diagnostic.DiagnosticMessage.Replacements.map(
                        (replacement) => ({
                            filePath: replacement.FilePath,
                            offset: replacement.Offset,
                            length: replacement.Length,
                            replacementText: replacement.ReplacementText,
                        }),
                    ) as ClazyReplacement[],
                } as ClazyDiagnosticMessage,
            }) as ClazyDiagnostic,
    );
}

function makeArgmuments(source: string) {
    const args: string[] = ["--export-fixes=-"];

    const checks = Config.checks;
    if (checks.length > 0) {
        args.push(`--checks=${checks.join(",")}`);
    }

    const extraArg = Config.extraArg;
    if (extraArg.length > 0) {
        args.push(`--extra-arg=${extraArg.join(" ")}`);
    }

    const extraArgBefore = Config.extraArgBefore;
    if (extraArgBefore.length > 0) {
        args.push(`--extra-arg-before=${extraArgBefore.join(" ")}`);
    }

    const headerFilter = Config.headerFilter;
    if (headerFilter.length > 0) {
        args.push(`--header-filter=${headerFilter}`);
    }

    const ignoreDirs = Config.ignoreDirs;
    if (ignoreDirs.length > 0) {
        args.push(`--ignore-dirs=${ignoreDirs}`);
    }

    const ignoreIncludedFiles = Config.ignoreIncludedFiles;
    if (ignoreIncludedFiles) {
        args.push(`--ignore-included-files`);
    }

    const onlyQt = Config.onlyQt;
    if (onlyQt) {
        args.push(`--only-qt`);
    }

    const qtDeveloper = Config.qtDeveloper;
    if (qtDeveloper) {
        args.push(`--qt-developer`);
    }

    const vfsoverlay = Config.vfsoverlay;
    if (vfsoverlay.length > 0) {
        args.push(`--vfsoverlay=${vfsoverlay}`);
    }

    const visitImplicitCode = Config.visitImplicitCode;
    if (visitImplicitCode) {
        args.push(`--visit-implicit-code`);
    }

    const buildPath = Config.buildPath;
    if (buildPath.length > 0) {
        args.push("-p", buildPath);
    }

    args.push(source);
    return args;
}

export function runClazy(source: string) {
    const executable = Config.executable;
    if (executable.length <= 0) {
        Log.error("Clazy executable path is empty!");
        window.showErrorMessage("Clazy executable path is empty!");
        return;
    }

    const argmuments = makeArgmuments(source);

    return window.withProgress(
        {
            location: ProgressLocation.Notification,
            title: "Running Clazy",
            cancellable: true,
        },
        (progress, token) => {
            progress.report({
                message: source,
            });

            return new Promise<ClazyDiagnostic[]>((resolve) => {
                Log.info(
                    `Running: "${executable}" ${argmuments.map((arg) => `"${arg}"`).join(" ")}`,
                );

                const process = execFile(
                    executable,
                    argmuments,
                    (error, stdout, stderr) => {
                        const clazyDiagnostics: ClazyDiagnostic[] = [];
                        if (error) {
                            Log.error(
                                "Error occurred while running Clazy:",
                                error,
                            );
                        } else {
                            if (stderr.length > 0) {
                                clazyDiagnostics.push(
                                    ...parseClazyStderr(stderr),
                                );
                            }

                            if (stdout.length > 0) {
                                clazyDiagnostics.push(
                                    ...parseClazyYaml(stdout),
                                );
                            }
                        }

                        resolve(clazyDiagnostics);
                    },
                );

                token.onCancellationRequested((_) => {
                    process.kill();
                });

                if (token.isCancellationRequested) {
                    process.kill();
                }
            });
        },
    );
}
