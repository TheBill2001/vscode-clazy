import { workspace } from "vscode";

export default class Config {
    static getConfigValue<Type = string>(name: string) {
        return workspace.getConfiguration("clazy").get<Type>(name);
    }

    static get executable() {
        return this.getConfigValue("executable")!;
    }

    static get checks() {
        return this.getConfigValue<string[]>("checks")!;
    }

    static get extraArg() {
        return this.getConfigValue<string[]>("extraArg")!;
    }

    static get extraArgBefore() {
        return this.getConfigValue<string[]>("extraArgBefore")!;
    }

    static get headerFilter() {
        return this.getConfigValue("headerFilter")!;
    }

    static get ignoreDirs() {
        return this.getConfigValue("ignoreDirs")!;
    }

    static get ignoreIncludedFiles() {
        return this.getConfigValue<boolean>("ignoreIncludedFiles")!;
    }

    static get onlyQt() {
        return this.getConfigValue<boolean>("onlyQt")!;
    }

    static get qtDeveloper() {
        return this.getConfigValue<boolean>("qtDeveloper")!;
    }

    static get vfsoverlay() {
        return this.getConfigValue("vfsoverlay")!;
    }

    static get visitImplicitCode() {
        return this.getConfigValue<boolean>("visitImplicitCode")!;
    }

    static get buildPath() {
        return this.getConfigValue("buildPath")!;
    }

    static get lintOnSave() {
        return this.getConfigValue<boolean>("lintOnSave")!;
    }
}
