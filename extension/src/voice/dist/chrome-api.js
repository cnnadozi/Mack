export function extensionChrome() {
    const chromeApi = globalThis.chrome;
    if (!chromeApi?.storage?.session || !chromeApi.runtime || !chromeApi.tabs) {
        throw new Error("This page must run inside the Mack extension.");
    }
    return chromeApi;
}
