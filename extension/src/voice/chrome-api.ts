interface SessionArea {
  get(keys: string[]): Promise<Record<string, unknown>>;
  set(items: Record<string, string>): Promise<void>;
}

interface ExtensionChrome {
  storage: { session: SessionArea };
  runtime: { getURL(path: string): string };
  tabs: { create(properties: { url: string }): Promise<unknown> };
}

export function extensionChrome(): ExtensionChrome {
  const chromeApi = (globalThis as { chrome?: ExtensionChrome }).chrome;
  if (!chromeApi?.storage?.session || !chromeApi.runtime || !chromeApi.tabs) {
    throw new Error("This page must run inside the Mack extension.");
  }
  return chromeApi;
}
