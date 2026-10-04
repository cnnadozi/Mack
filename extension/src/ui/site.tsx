// The pieces of the source website that both simple-view layouts show: its logo
// and its search box. The data comes from Role 4 through the shared contract.

import { useEffect, useId, useState, type FormEvent } from "react";
import { Search } from "lucide-react";

import type { SiteLogo, SiteSearch } from "../../../shared/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useTranslator } from "./i18n";

/** The site's logo on the colour it normally sits on, or its name if the image fails. */
export function SiteLogoView({ logo, className }: { logo: SiteLogo; className?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [logo.src]);
  if (failed)
    return <span className={cn("truncate text-lg font-semibold", className)}>{logo.alt}</span>;
  // A bare site icon says nothing by itself, so the site's name goes beside it.
  const iconOnly = logo.kind === "icon";
  return (
    <span className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <span
        className="mack-logo flex h-11 shrink-0 items-center rounded-xl px-2.5 shadow-xs"
        style={{ background: logo.background }}
      >
        <img
          src={logo.src}
          alt={iconOnly ? "" : logo.alt}
          className="max-h-7 max-w-[180px]"
          onError={() => setFailed(true)}
        />
      </span>
      {iconOnly && <span className="truncate text-lg font-semibold">{logo.alt}</span>}
    </span>
  );
}

/** A large box that runs the site's own search. */
export function SiteSearchBox(props: {
  search: SiteSearch;
  onSearch(actionId: string, text: string): void;
  className?: string;
}) {
  const { t } = useTranslator();
  const inputId = useId();
  const [draft, setDraft] = useState("");
  const submit = (event: FormEvent): void => {
    event.preventDefault();
    const text = draft.trim();
    if (text) props.onSearch(props.search.actionId, text);
  };
  return (
    <form className={cn("flex gap-2", props.className)} role="search" onSubmit={submit}>
      <label htmlFor={inputId} className="sr-only">
        {props.search.label}
      </label>
      <Input
        id={inputId}
        type="search"
        autoComplete="off"
        className="h-12 rounded-xl bg-background px-4 text-lg text-foreground"
        placeholder={props.search.label}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
      <Button
        type="submit"
        variant="secondary"
        className="h-12 rounded-xl px-5 text-lg"
        disabled={!draft.trim()}
      >
        <Search />
        {t("search")}
      </Button>
    </form>
  );
}
