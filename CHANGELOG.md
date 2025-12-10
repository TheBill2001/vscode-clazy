# Change Log

All notable changes to the "vscode-clazy" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## v1.1.0

A lot of refactoring and update dependencies:

- Adding Clazy icon. (How did I miss that?)
- Reading diagnostic from `stderr` (#3).
- Adding [diagnostics' related information](https://code.visualstudio.com/api/references/vscode-api#DiagnosticRelatedInformation) read from `stderr`.
- Deduplicating and merging similar diagnostics (#2, #3).
- More sensible notification.

Configuration:

- Adding pre-defined list of check values to `clazy.checks`.
- Removing default values for `clazy.extraArg` and `clazy.extraArgBefore`.
- Changing `clazy.ignoreIncludedFiles` default value to `true`.
- `clazy.blacklist` has been removed.

## v1.0.1

- Fix mutil-replacement diagnostic not being apply correctly. Removed auto fix on save function (fixes #1).
    > Clazy need to be re-run again after every applied fix, otherwise the replacement ranges become incorrect. Handling this in vscode is quite cumbersome. In the future, I could look into using clang-apply-replacements.

## v1.0.0

- Initial release
