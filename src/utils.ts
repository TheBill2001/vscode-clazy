import { window } from "vscode";

export default class Utils {
    static #logChannel = window.createOutputChannel("Clazy", {
        log: true,
    });

    static get log() {
        return this.#logChannel;
    }

    static set log(_) {
        this.noSetterMessage("Utils.log");
    }

    static noSetterMessage(name: string) {
        if (!name) {
            return;
        }
        this.log.debug(`Attempt to set ${name} does nothing.`);
    }
}
