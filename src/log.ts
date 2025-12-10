import { window } from "vscode";

export default class Log {
    static #logChannel = window.createOutputChannel("Clazy", {
        log: true,
    });

    /**
     * Get the output channel
     */
    static get channel() {
        return this.#logChannel;
    }

    /**
     * Outputs the given information message.
     * @param message info message to log
     */
    static info(message: string, ...args: any[]) {
        this.#logChannel.info(message, ...args);
    }

    /**
     * Outputs the given error message.
     * @param message error message to log
     */
    static error(message: string, ...args: any[]) {
        this.#logChannel.error(message, ...args);
    }
}
