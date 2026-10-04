// DEVELOPMENT FIXTURES ONLY. The page below is invented so the guidance module
// can be exercised before a real website and a live model are wired in. It is
// not the demo site and must not be used in the final flow.

import type { GuidanceOutcome, GuidanceRequest, ModelClient } from './contract.pending';

export interface GuidanceFixture {
  name: string;
  request: GuidanceRequest;
  modelReply: string;
  expected: GuidanceOutcome;
}

const page: GuidanceRequest['page'] = {
  url: 'https://library.example/account',
  title: 'My account — Example City Library',
  headings: ['My account', 'Loans', 'Help'],
  text: ['You have 2 books on loan.', 'Questions? Send us a message.'],
  actions: [
    { id: 'a1', kind: 'link', label: 'Renew loans' },
    { id: 'a2', kind: 'link', label: 'Search the catalogue' },
    { id: 'a3', kind: 'link', label: 'Opening hours & locations' },
    { id: 'a4', kind: 'field', label: 'Your message' },
    { id: 'a5', kind: 'submit', label: 'Send message' },
    { id: 'a6', kind: 'button', label: 'Pay fines online', disabled: true },
  ],
};

const screen: GuidanceRequest['screen'] = {
  title: 'Your library account',
  sections: [
    {
      title: 'Your books',
      actions: [
        { actionId: 'a1', label: 'Renew my books' },
        { actionId: 'a2', label: 'Find a book' },
      ],
    },
  ],
};

function request(requestId: string, text: string): GuidanceRequest {
  return { requestId, snapshotVersion: 3, screenVersion: 7, text, page, screen };
}

export const existingShortcut: GuidanceFixture = {
  name: 'existing shortcut',
  request: request('fx-existing', 'I need more time with my books'),
  modelReply: JSON.stringify({
    status: 'ready',
    targetActionId: 'a1',
    instruction: 'Press "Renew my books" to keep your books longer.',
  }),
  expected: {
    status: 'ready',
    targetActionId: 'a1',
    instruction: 'Press "Renew my books" to keep your books longer.',
    additions: [],
  },
};

export const omittedAction: GuidanceFixture = {
  name: 'omitted action',
  request: request('fx-omitted', 'When are you open?'),
  modelReply: JSON.stringify({
    status: 'ready',
    targetActionId: 'a3',
    additionLabel: 'Opening hours',
    instruction: 'Press "Opening hours" to see when the library is open.',
  }),
  expected: {
    status: 'ready',
    targetActionId: 'a3',
    instruction: 'Press "Opening hours" to see when the library is open.',
    additions: [{ actionId: 'a3', label: 'Opening hours' }],
  },
};

export const unavailableAction: GuidanceFixture = {
  name: 'unavailable action',
  request: request('fx-unavailable', 'I want to book a meeting room'),
  modelReply: JSON.stringify({
    status: 'missing_target',
    message: 'I cannot find a way to book a meeting room on this page.',
  }),
  expected: {
    status: 'missing_target',
    message: 'I cannot find a way to book a meeting room on this page.',
  },
};

export const originalFormTarget: GuidanceFixture = {
  name: 'original form target',
  request: request('fx-original', 'I want to write to the library'),
  modelReply: JSON.stringify({
    status: 'use_original',
    targetActionId: 'a4',
    instruction: 'Type what you want to say in the "Your message" box.',
  }),
  expected: {
    status: 'use_original',
    targetActionId: 'a4',
    instruction: 'Type what you want to say in the "Your message" box.',
  },
};

export const fixtures: GuidanceFixture[] = [
  existingShortcut,
  omittedAction,
  unavailableAction,
  originalFormTarget,
];

// Stand-in for Role 4's ModelClient that answers with canned replies in order,
// repeating the last one.
export function fixtureModel(...replies: string[]): ModelClient {
  let call = 0;
  return {
    complete: async () => replies[Math.min(call++, replies.length - 1)] ?? '',
  };
}
