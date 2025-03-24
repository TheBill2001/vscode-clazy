import { ChildProcess, execFile } from "child_process";

import {
    window,
    ProgressLocation,
    DiagnosticSeverity,
    workspace,
    TextDocument,
} from "vscode";
import YAML from "yaml";

import Utils from "./utils";
import Config from "./config";

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
    Severity: "Warning" | "Error" | "Info" | "Hint";
}

export interface ClazyDiagnosticYaml {
    DiagnosticName: string;
    DiagnosticMessage: ClazyDiagnosticMessageYaml;
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
    fileOffset: number;
    replacements: ClazyReplacement[];
    severity: DiagnosticSeverity;
}

export interface ClazyDiagnostic {
    diagnosticName: string;
    diagnosticMessage: ClazyDiagnosticMessage;
}

export class ClazyResult {
    mainSourceFile = "";
    rawOutput = "";
    diagnostics: ClazyDiagnostic[] = [];

    constructor(output: string) {
        const yamlIndex = output.search(/^---$/m);
        if (yamlIndex < 0) {
            return;
        }

        const yamlDoc = output.substring(yamlIndex);

        const parsed = YAML.parse(yamlDoc) as ClazyYaml;

        this.rawOutput = yamlDoc;
        this.mainSourceFile = parsed.MainSourceFile;
        this.diagnostics = parsed.Diagnostics.map((value) => ({
            diagnosticName: value.DiagnosticName,
            diagnosticMessage: {
                message: value.DiagnosticMessage.Message,
                filePath: value.DiagnosticMessage.FilePath,
                fileOffset: value.DiagnosticMessage.FileOffset,
                severity: ClazyResult.#parseSeverity(
                    value.DiagnosticMessage.Severity,
                ),
                replacements: value.DiagnosticMessage.Replacements.map(
                    (value) => ({
                        filePath: value.FilePath,
                        offset: value.Offset,
                        length: value.Length,
                        replacementText: value.ReplacementText,
                    }),
                ) as ClazyReplacement[],
            } as ClazyDiagnosticMessage,
        }));
    }

    static #parseSeverity(severity: string) {
        switch (severity) {
            case "Info":
                return DiagnosticSeverity.Information;
            case "Error":
                return DiagnosticSeverity.Error;
            case "Hint":
                return DiagnosticSeverity.Hint;
            default:
                return DiagnosticSeverity.Warning;
        }
    }
}

export default class Clazy {
    static run(files: string[], workingDirectory: string) {
        return window.withProgress(
            {
                location: ProgressLocation.Notification,
                cancellable: true,
            },
            (progress, token) => {
                progress.report({
                    message: `Clazy is running for file:\n${files.join("\n")}`,
                });

                return new Promise<ClazyResult>((resolve) => {
                    const clangTidy = Config.executable;
                    const args = this.#makeArgs(files);

                    Utils.log.appendLine(`> ${clangTidy} ${args.join(" ")}`);
                    Utils.log.appendLine(
                        `Working Directory: ${workingDirectory}`,
                    );

                    let process = execFile(
                        clangTidy,
                        args,
                        { cwd: workingDirectory },
                        (error, stdout, stderr) => {
                            if (error) {
                                window.showErrorMessage(
                                    "Error occurred while running Clazy. Check the output panel for more details.",
                                );
                                Utils.log.error(error);
                            }

                            Utils.log.debug(stdout);
                            Utils.log.warn(stderr);

                            resolve(new ClazyResult(stdout));
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

    static #makeArgs(files: string[]) {
        let args: string[] = [...files, "--export-fixes=-"];

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
            args.push("-p");
            args.push(buildPath);
        }

        return args;
    }
}
