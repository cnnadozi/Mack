// PROVISIONAL — Role 2's proposal for the guidance part of shared/contracts.ts.
// Role 4 owns the real contract. Once it lands there, delete this file and point
// the imports in this folder at shared/contracts instead. Do not import this file
// from outside extension/src/guidance/.

export type SourceActionKind = 'link' | 'button' | 'field' | 'submit';

export interface SourceAction {
  id: string;
  kind: SourceActionKind;
  label: string;
  disabled?: boolean;
}

export interface PageSnapshot {
  url: string;
  title: string;
  headings: string[];
  text: string[];
  actions: SourceAction[];
}

export interface ScreenAction {
  actionId: string;
  label: string;
}

export interface ScreenSection {
  title?: string;
  actions: ScreenAction[];
}

export interface ScreenDesign {
  title: string;
  sections: ScreenSection[];
}

export interface RequestVersions {
  requestId: string;
  snapshotVersion: number;
  screenVersion: number;
}

export interface GuidanceRequest extends RequestVersions {
  text: string;
  page: PageSnapshot;
  screen: ScreenDesign;
}

export type GuidanceOutcome =
  | { status: 'ready'; instruction: string; targetActionId: string; additions: ScreenAction[] }
  | { status: 'use_original'; instruction: string; targetActionId: string }
  | { status: 'clarification'; question: string; options: string[] }
  | { status: 'missing_target'; message: string };

export type GuidanceProposal = RequestVersions & GuidanceOutcome;

export interface ModelClient {
  complete(input: { system: string; user: string; signal?: AbortSignal }): Promise<string>;
}

export class ContractError extends Error {}

const ACTION_KINDS: readonly string[] = ['link', 'button', 'field', 'submit'];

function fail(path: string, expected: string): never {
  throw new ContractError(`${path} must be ${expected}`);
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(path, 'an object');
  return value as Record<string, unknown>;
}

function text(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim() === '') fail(path, 'a non-empty string');
  return value as string;
}

function version(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    fail(path, 'a non-negative integer');
  }
  return value as number;
}

function list<T>(value: unknown, path: string, item: (entry: unknown, path: string) => T): T[] {
  if (!Array.isArray(value)) fail(path, 'an array');
  return (value as unknown[]).map((entry, index) => item(entry, `${path}[${index}]`));
}

function plainString(value: unknown, path: string): string {
  if (typeof value !== 'string') fail(path, 'a string');
  return value as string;
}

function sourceAction(value: unknown, path: string): SourceAction {
  const raw = record(value, path);
  if (typeof raw.kind !== 'string' || !ACTION_KINDS.includes(raw.kind)) {
    fail(`${path}.kind`, `one of ${ACTION_KINDS.join(', ')}`);
  }
  if (raw.disabled !== undefined && typeof raw.disabled !== 'boolean') {
    fail(`${path}.disabled`, 'a boolean');
  }
  return {
    id: text(raw.id, `${path}.id`),
    kind: raw.kind as SourceActionKind,
    label: text(raw.label, `${path}.label`),
    disabled: raw.disabled === true,
  };
}

function screenAction(value: unknown, path: string): ScreenAction {
  const raw = record(value, path);
  return {
    actionId: text(raw.actionId, `${path}.actionId`),
    label: text(raw.label, `${path}.label`),
  };
}

function screenSection(value: unknown, path: string): ScreenSection {
  const raw = record(value, path);
  return {
    title: raw.title === undefined ? undefined : plainString(raw.title, `${path}.title`),
    actions: list(raw.actions, `${path}.actions`, screenAction),
  };
}

export function parseGuidanceRequest(value: unknown): GuidanceRequest {
  const raw = record(value, 'request');
  const page = record(raw.page, 'request.page');
  const screen = record(raw.screen, 'request.screen');

  const actions = list(page.actions, 'request.page.actions', sourceAction);
  if (new Set(actions.map((action) => action.id)).size !== actions.length) {
    fail('request.page.actions', 'free of duplicate ids');
  }

  return {
    requestId: text(raw.requestId, 'request.requestId'),
    snapshotVersion: version(raw.snapshotVersion, 'request.snapshotVersion'),
    screenVersion: version(raw.screenVersion, 'request.screenVersion'),
    text: text(raw.text, 'request.text'),
    page: {
      url: plainString(page.url, 'request.page.url'),
      title: plainString(page.title, 'request.page.title'),
      headings: list(page.headings, 'request.page.headings', plainString),
      text: list(page.text, 'request.page.text', plainString),
      actions,
    },
    screen: {
      title: plainString(screen.title, 'request.screen.title'),
      sections: list(screen.sections, 'request.screen.sections', screenSection),
    },
  };
}
