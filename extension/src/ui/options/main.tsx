import { StrictMode, useEffect, useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";

import "../styles.css";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { generateJSON, ProviderRejected } from "../../platform/provider";
import { DEFAULT_MODEL, KEY_STORAGE, MODEL_STORAGE, trustedSession } from "../../platform/settings";

const TEST_TIMEOUT_MS = 15_000;

// Optional setup for the simple view and its guidance. Without it they use the
// GEMINI_API_KEY the extension was built with and Role 4's default model.
function Options() {
  const [key, setKey] = useState("");
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [status, setStatus] = useState("");

  useEffect(() => {
    void chrome.storage.session.get(MODEL_STORAGE).then((stored) => {
      const saved = stored[MODEL_STORAGE];
      if (typeof saved === "string" && saved) setModel(saved);
    });
  }, []);

  async function save(event: FormEvent): Promise<void> {
    event.preventDefault();
    const trimmedKey = key.trim();
    const trimmedModel = model.trim();
    if (!trimmedKey || !trimmedModel) return;
    setStatus(`Testing ${trimmedModel}…`);
    try {
      await generateJSON(
        { task: "guide", system: 'Reply with the JSON object {"ok":true}.', payload: "ping" },
        trimmedKey,
        trimmedModel,
        AbortSignal.timeout(TEST_TIMEOUT_MS),
      );
    } catch (error) {
      // Some Gemini models reject generateContent; say so instead of saving.
      setStatus(
        error instanceof ProviderRejected
          ? `${trimmedModel} can't be used: ${error.message}`
          : "The test request failed. Check your connection and try again.",
      );
      return;
    }
    try {
      await trustedSession();
      await chrome.storage.session.set({
        [KEY_STORAGE]: trimmedKey,
        [MODEL_STORAGE]: trimmedModel,
      });
      setKey("");
      setStatus(`Saved (${trimmedModel}). Open a website and click Mack.`);
    } catch {
      setStatus("Could not save the key. Reload Mack and try again.");
    }
  }

  async function forget(): Promise<void> {
    try {
      await chrome.storage.session.remove([KEY_STORAGE, MODEL_STORAGE]);
      setModel(DEFAULT_MODEL);
      setStatus("Key removed. Mack uses the key it was built with again.");
    } catch {
      setStatus("Could not remove the key. Reload Mack to clear this session.");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted p-6">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle className="text-2xl">Mack setup</CardTitle>
          <CardDescription className="text-base">
            This is optional. Mack's simple view already uses the Gemini key the extension was built
            with. To try a different key or model, enter it here. It is kept for this browser
            session only, and only Mack's background worker reads it; web pages never see it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={(event) => void save(event)}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="api-key" className="text-base">
                Gemini API key
              </Label>
              <Input
                id="api-key"
                type="password"
                autoComplete="off"
                required
                className="h-11"
                value={key}
                onChange={(event) => setKey(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="model" className="text-base">
                Model
              </Label>
              <Input
                id="model"
                type="text"
                autoComplete="off"
                spellCheck={false}
                required
                className="h-11"
                value={model}
                onChange={(event) => setModel(event.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" className="h-11 px-5 text-base">
                Test and save for this session
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 px-5 text-base"
                onClick={() => void forget()}
              >
                Forget key
              </Button>
            </div>
            <p role="status" aria-live="polite" className="min-h-6 text-base text-muted-foreground">
              {status}
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Options />
  </StrictMode>,
);
