import { workspace } from "vscode";

import Utils from "./utils";

export default class Config {
    static getConfigValue<Type = string>(name: string) {
        return workspace.getConfiguration("clazy").get(name) as Type;
    }

    static get executable() {
        return this.getConfigValue("executable");
    }

    static set executable(_) {
        Utils.noSetterMessage("Config.executablePath");
    }

    static get checks() {
        return this.getConfigValue<string[]>("checks");
    }

    static set checks(_) {
        Utils.noSetterMessage("Config.checks");
    }

    static get extraArg() {
        return this.getConfigValue<string[]>("extraArg");
    }

    static set extraArg(_) {
        Utils.noSetterMessage("Config.extraArg");
    }

    static get extraArgBefore() {
        return this.getConfigValue<string[]>("extraArgBefore");
    }

    static set extraArgBefore(_) {
        Utils.noSetterMessage("Config.extraArgBefore");
    }

    static get headerFilter() {
        return this.getConfigValue("headerFilter");
    }

    static set headerFilter(_) {
        Utils.noSetterMessage("Config.headerFilter");
    }

    static get ignoreDirs() {
        return this.getConfigValue("ignoreDirs");
    }

    static set ignoreDirs(_) {
        Utils.noSetterMessage("Config.ignoreDirs");
    }

    static get ignoreIncludedFiles() {
        return this.getConfigValue<boolean>("ignoreIncludedFiles");
    }

    static set ignoreIncludedFiles(_) {
        Utils.noSetterMessage("Config.ignoreIncludedFiles");
    }

    static get onlyQt() {
        return this.getConfigValue<boolean>("onlyQt");
    }

    static set onlyQt(_) {
        Utils.noSetterMessage("Config.onlyQt");
    }

    static get qtDeveloper() {
        return this.getConfigValue<boolean>("qtDeveloper");
    }

    static set qtDeveloper(_) {
        Utils.noSetterMessage("Config.qtDeveloper");
    }

    static get vfsoverlay() {
        return this.getConfigValue("vfsoverlay");
    }

    static set vfsoverlay(_) {
        Utils.noSetterMessage("Config.vfsoverlay");
    }

    static get visitImplicitCode() {
        return this.getConfigValue<boolean>("visitImplicitCode");
    }

    static set visitImplicitCode(_) {
        Utils.noSetterMessage("Config.visitImplicitCode");
    }

    static get buildPath() {
        return this.getConfigValue("buildPath");
    }

    static set buildPath(_) {
        Utils.noSetterMessage("Config.buildPath");
    }

    static get lintOnSave() {
        return this.getConfigValue<boolean>("lintOnSave");
    }

    static set lintOnSave(_) {
        Utils.noSetterMessage("Config.lintOnSave");
    }

    static get blacklist() {
        const value = this.getConfigValue<string[]>("blacklist");
        if (value.length > 0) {
            return value;
        }

        if (process.platform === "win32") {
            return ["build[\\].*"];
        } else {
            return ["build[\/].*"];
        }
    }

    static set blacklist(_) {
        Utils.noSetterMessage("Config.blacklist");
    }
}
