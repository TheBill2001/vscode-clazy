# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## v1.0.1

- 1f045c558a0b14a70523e7cc145ed49524dd3991: Fix mutil-replacement diagnostic not being apply correctly. Removed auto fix on save function (fixes #1).
    > Clazy need to be re-run again after every applied fix, otherwise the replacement ranges become incorrect. Handling this in vscode is quite cumbersome. In the future, I could look into using clang-apply-replacements.

## v1.0.0

- Initial release
