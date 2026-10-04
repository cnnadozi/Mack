// Pressing a simple-view button usually loads another page. This marks that the
// next page should get a simple view too, so the user is not dropped back onto
// the raw website mid-journey. It is in sessionStorage because that belongs to
// this tab; a hop to another website loses it.

const KEY = "mack-simple-view-continue";
const VALID_MS = 20_000;

export function rememberToContinue(): void {
  try {
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    // Storage is blocked on this site; the next page just starts without a simple view.
  }
}

/** True once, on the page reached by pressing a simple-view button. */
export function shouldContinue(): boolean {
  try {
    const pressed = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return pressed !== null && Date.now() - Number(pressed) < VALID_MS;
  } catch {
    return false;
  }
}
