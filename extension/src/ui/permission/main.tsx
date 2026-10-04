import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

import "../styles.css";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { debug } from "../../platform/debug";
import type { RuntimeMessage } from "../../platform/messages";

// Chrome only shows the microphone prompt in a visible extension tab, not in the
// popup or the offscreen document. This page exists for that one-time prompt.
function Permission() {
  const [denied, setDenied] = useState(false);

  async function ask(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      for (const track of stream.getTracks()) track.stop();
      debug("permission", "microphone allowed, starting Mack");
      await chrome.runtime.sendMessage({ type: "mack:start" } satisfies RuntimeMessage);
      window.close();
    } catch (error) {
      debug("permission", "microphone request failed, starting Mack for typing only", error);
      setDenied(true);
      void chrome.runtime.sendMessage({ type: "mack:start", typingOnly: true } satisfies RuntimeMessage);
    }
  }

  useEffect(() => {
    void ask();
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted p-6">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Mack needs your microphone</CardTitle>
          <CardDescription className="text-lg">
            Chrome asks once. Choose Allow, and this tab closes and Mack starts listening.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {denied ? (
            <p role="alert" className="text-lg text-destructive">
              The microphone is blocked for Mack. You can still type your question in the Mack box
              on the website. To talk instead, click the icon at the left of the address bar, allow
              the microphone, then try again.
            </p>
          ) : null}
          <Button size="lg" className="h-16 rounded-xl text-xl" onClick={() => void ask()}>
            Allow microphone
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Permission />
  </StrictMode>,
);
