# Clazy for VSCode

VSCode extension for [Clazy](https://invent.kde.org/sdk/clazy).

## Features

- Lint files.
- Quick fixes.
- Show link to Clazy check's document.

![screenshot.png](screenshot.png)

## Downloads

You can download the extension from GitHub release page, or from:
- [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=TheBill2001.vscode-clazy)
- [Open VSX Registry](https://open-vsx.org/extension/TheBill2001/vscode-clazy)

## Requirements

This extension requires `clazy-standalone` binary. You can find the build instruction [here](https://invent.kde.org/sdk/clazy#build-instructions), or download from your distro's repo. Additionally, `clazy-standalone` requires a [compilation database JSON file](https://invent.kde.org/sdk/clazy#clazy-standalone-and-json-database-support) to work, i.e. CMake's `-DCMAKE_EXPORT_COMPILE_COMMANDS=ON`.

## Extension Settings

The main configuration options:

- `clazy.executable`: Path to Clazy standalone executable. Default is `clazy-standalone`.
- `clazy.checks`: Array of clazy checks. Default are `level0` and `level1`.
- `clazy.buildPath`: Path to the build folder. This folder should be where the compilation database JSON file locates at.
> [!TIP]
> When no build path is specified, a search for `compile_commands.json` will be attempted through all parent paths of the source file by Clazy.
> In such case, you can make a copy, symbolic link of the compilation database to the workspace folder. The CMake Tools extension allow such operation via `cmake.copyCompileCommands` option.
- `clazy.lintOnSave`: Automatically lint files when they are saved. Default is `true`.

> [!NOTE]
> None of the options support variable substitution as VSCode does not provide any public API for such task.

## Related project

- [Clazy](https://invent.kde.org/sdk/clazy)
- [vscode-clang-tidy](https://github.com/notskm/vscode-clang-tidy)
