// The simple view as a redesign of the page: the site's own name, colour and
// pictures, a summary and key facts, and every action as a card with an icon and
// a line about what it does. Used when the extension supplies ScreenDetails;
// every card is still one of the contract's grounded buttons.

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Briefcase,
  Calendar,
  ChevronRight,
  CircleHelp,
  Clock,
  CreditCard,
  Download,
  FileText,
  Gift,
  Globe,
  Heart,
  House,
  Image as ImageIcon,
  Info,
  List,
  LogIn,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Play,
  Search,
  Settings,
  Shield,
  ShoppingCart,
  Star,
  Tag,
  Truck,
  User,
  type LucideIcon,
} from "lucide-react";

import type { ScreenSection, TaskButton } from "../../../shared/contracts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { isMoreSection } from "./design/validate";
import { sectionKey, type IconName, type ScreenDetails } from "./details";
import type { MackAppProps } from "./MackApp";
import { SiteLogoView, SiteSearchBox } from "./site";
import { taskIcon } from "./taskIcon";
import { paletteFor } from "./theme";
import { useTranslator } from "./i18n";

const ICONS: Record<IconName, LucideIcon> = {
  search: Search,
  cart: ShoppingCart,
  user: User,
  phone: Phone,
  mail: Mail,
  map: MapPin,
  calendar: Calendar,
  info: Info,
  help: CircleHelp,
  home: House,
  star: Star,
  heart: Heart,
  settings: Settings,
  document: FileText,
  card: CreditCard,
  delivery: Truck,
  tag: Tag,
  book: BookOpen,
  play: Play,
  download: Download,
  "sign-in": LogIn,
  message: MessageCircle,
  clock: Clock,
  shield: Shield,
  globe: Globe,
  work: Briefcase,
  gift: Gift,
  list: List,
  image: ImageIcon,
  arrow: ArrowRight,
};

// Just under the extension's own bar, which must stay on top of the simple view.
const LAYER = "z-[2147483646]";

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

// A picture from the website. It may be missing or blocked, and then it is left out.
function Picture(props: { src?: string; className: string; fallback?: ReactNode }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [props.src]);
  if (!props.src || failed) return <>{props.fallback ?? null}</>;
  return (
    <img
      src={props.src}
      alt=""
      loading="lazy"
      className={props.className}
      onError={() => setFailed(true)}
    />
  );
}

function ActionCard(props: {
  button: TaskButton;
  detail?: NonNullable<ScreenDetails["actions"]>[string];
  color?: string;
  highlighted: boolean;
  badgeId: string;
  onAction(id: string): void;
}) {
  const { t } = useTranslator();
  const { button, detail, highlighted, badgeId } = props;
  // The model's pick, else a guess from the label.
  const Icon = detail?.icon ? ICONS[detail.icon] : taskIcon(button.label);
  const iconTile = (
    <span
      className={cn(
        "grid size-12 shrink-0 place-items-center rounded-xl",
        !props.color && "bg-muted",
        highlighted && "bg-primary-foreground/15",
      )}
      // A light wash of the site's own colour, with the icon in that colour.
      style={
        props.color && !highlighted
          ? {
              backgroundColor: `color-mix(in srgb, ${props.color} 14%, transparent)`,
              color: props.color,
            }
          : undefined
      }
    >
      <Icon className="size-6" />
    </span>
  );
  return (
    <Button
      type="button"
      variant={highlighted ? "default" : "outline"}
      className={cn(
        "h-full min-h-20 w-full justify-start gap-4 rounded-2xl bg-card px-4 py-3 text-left whitespace-normal shadow-xs transition-shadow hover:shadow-md",
        highlighted &&
          "bg-primary ring-4 ring-ring/60 forced-colors:outline-4 forced-colors:outline-[Highlight]",
      )}
      data-action-id={button.actionId}
      data-highlighted={highlighted || undefined}
      aria-describedby={highlighted ? badgeId : undefined}
      onClick={() => props.onAction(button.actionId)}
    >
      <Picture
        src={detail?.image}
        className="size-14 shrink-0 rounded-xl object-cover"
        fallback={iconTile}
      />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-lg leading-snug font-semibold">{button.label}</span>
        {detail?.description && (
          <span className="text-sm leading-snug font-normal opacity-70">{detail.description}</span>
        )}
      </span>
      {highlighted ? (
        <Badge
          variant="secondary"
          className="px-2.5 py-1 text-sm forced-colors:border-2 forced-colors:border-[CanvasText]"
          id={badgeId}
        >
          {t("nextStep")}
        </Badge>
      ) : (
        <ChevronRight className="size-5 shrink-0 opacity-40" />
      )}
    </Button>
  );
}

function SectionCards(props: {
  section: ScreenSection;
  details: ScreenDetails;
  color?: string;
  idPrefix: string;
  highlightedActionId?: string;
  badgeId: string;
  onAction(id: string): void;
}) {
  const { section, details } = props;
  const headingId = `${props.idPrefix}-${section.id}`;
  const description = details.sections?.[sectionKey(section.heading)]?.description;
  return (
    <section
      className="flex flex-col gap-3"
      aria-labelledby={section.heading ? headingId : undefined}
    >
      {section.heading && (
        <div className="flex flex-col gap-0.5">
          <h2 id={headingId} className="m-0 text-xl font-semibold">
            {section.heading}
          </h2>
          {description && <p className="m-0 text-base text-muted-foreground">{description}</p>}
        </div>
      )}
      <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {section.buttons.map((button) => (
          <li key={button.actionId}>
            <ActionCard
              button={button}
              detail={details.actions?.[button.actionId]}
              color={props.color}
              highlighted={button.actionId === props.highlightedActionId}
              badgeId={props.badgeId}
              onAction={props.onAction}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function RichView(props: MackAppProps & { details: ScreenDetails; guidance: ReactNode }) {
  const { t, dir, lang } = useTranslator();
  const { state, details, onAction, onSearch, onPreviousPage, onShowOriginal, onExit } = props;
  const { screen, highlightedActionId } = state;
  const { site } = details;
  const idPrefix = useId();
  const cards = useRef<HTMLDivElement>(null);
  const buttonCount = screen.sections.reduce((count, section) => count + section.buttons.length, 0);
  // The main things first, then everything else the page offers.
  const sections = [
    ...screen.sections.filter((section) => !isMoreSection(section)),
    ...screen.sections.filter(isMoreSection),
  ];

  useEffect(() => {
    if (!highlightedActionId) return;
    const target = Array.from(
      cards.current?.querySelectorAll<HTMLElement>("[data-action-id]") ?? [],
    ).find((element) => element.dataset.actionId === highlightedActionId);
    target?.scrollIntoView?.({
      block: "nearest",
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  }, [highlightedActionId, screen.screenVersion]);

  // The site's brand colour, darkened where needed so white text on it is readable.
  const accent = state.accentColor ? paletteFor(state.accentColor).accent : undefined;
  return (
    <section
      className={cn(
        "mack-overlay fixed inset-0 overflow-y-auto overscroll-contain bg-muted",
        LAYER,
      )}
      aria-label={t("simplifiedView")}
      dir={dir}
      lang={lang}
    >
      <div className="mx-auto flex min-h-full max-w-[1040px] flex-col gap-6 px-4 pt-4 pb-40">
        <header className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-11 rounded-xl bg-card [&_svg:not([class*='size-'])]:size-5"
            aria-label={t("previousPage")}
            title={t("previousPage")}
            onClick={onPreviousPage}
          >
            <ArrowLeft />
          </Button>
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            {state.siteLogo ? (
              <SiteLogoView logo={state.siteLogo} />
            ) : (
              <span className="truncate text-lg font-semibold">{site?.name}</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2" role="toolbar" aria-label={t("controls")}>
            <Button
              type="button"
              variant="outline"
              className="h-11 bg-card px-4 text-base"
              onClick={onShowOriginal}
            >
              {t("originalPage")}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 bg-card px-4 text-base"
              onClick={onExit}
            >
              {t("exitMack")}
            </Button>
          </div>
        </header>

        <div
          className={cn(
            "flex items-center gap-6 rounded-3xl p-6 shadow-sm sm:p-8",
            !accent && "border bg-card",
          )}
          // The site's own colour, darkened a little towards one corner.
          style={
            accent
              ? {
                  background: `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${accent} 72%, black))`,
                  color: "#ffffff",
                }
              : undefined
          }
        >
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <h1 className="m-0 text-2xl leading-tight font-bold tracking-tight sm:text-3xl">
              {screen.title}
            </h1>
            {details.summary && (
              <p className="m-0 max-w-[60ch] text-lg opacity-90">{details.summary}</p>
            )}
            {screen.search && (
              <SiteSearchBox search={screen.search} onSearch={onSearch} className="max-w-[520px]" />
            )}
          </div>
          <Picture
            src={site?.image}
            className="hidden h-36 w-56 shrink-0 rounded-2xl object-cover shadow-md md:block"
          />
        </div>

        {props.guidance}

        {details.highlights && details.highlights.length > 0 && (
          <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {details.highlights.map((fact) => (
              <li key={`${fact.title} ${fact.text}`}>
                <Card className="h-full gap-1 rounded-2xl px-4 py-3 shadow-xs">
                  <span className="text-sm font-medium text-muted-foreground">{fact.title}</span>
                  <span className="text-lg leading-snug font-semibold">{fact.text}</span>
                </Card>
              </li>
            ))}
          </ul>
        )}

        <div ref={cards} className="flex flex-col gap-8">
          {sections.map((section) => (
            <SectionCards
              key={section.id}
              section={section}
              details={details}
              color={accent}
              idPrefix={idPrefix}
              highlightedActionId={highlightedActionId}
              badgeId={`${idPrefix}-badge`}
              onAction={onAction}
            />
          ))}
          {state.busy && buttonCount === 0 && (
            <div
              className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
              aria-hidden="true"
            >
              {Array.from({ length: 6 }, (_, index) => (
                <div
                  key={index}
                  className="h-20 animate-pulse rounded-2xl bg-card motion-reduce:animate-none"
                />
              ))}
            </div>
          )}
          {buttonCount === 0 && !state.busy && (
            <p className="m-0 text-xl text-muted-foreground">
              {t("noActions")}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
