import assert from "node:assert/strict";
import { test } from "node:test";

import { createCache } from "./cache";
import type { PageSnapshot } from "./messages";
import { replyKey } from "./reply-cache";

test("a cached value is returned until it expires", () => {
  let time = 0;
  const cache = createCache<string>({ maxEntries: 5, ttlMs: 1000, now: () => time });
  cache.set("a", "one");
  time = 999;
  assert.equal(cache.get("a"), "one");
  time = 1000;
  assert.equal(cache.get("a"), undefined);
});

test("the least recently used value is dropped when the cache is full", () => {
  const cache = createCache<string>({ maxEntries: 2, ttlMs: 1000, now: () => 0 });
  cache.set("a", "one");
  cache.set("b", "two");
  cache.get("a");
  cache.set("c", "three");
  assert.equal(cache.get("a"), "one");
  assert.equal(cache.get("b"), undefined);
  assert.equal(cache.get("c"), "three");
});

test("the same question on the same page shares a key, whatever the punctuation", () => {
  const page: PageSnapshot = {
    url: "https://shop.example/",
    title: "Shop",
    headings: [],
    elements: [{ id: "m1", kind: "link", label: "Contact", region: "top right" }],
    content: "[m1 link: Contact]",
  };
  assert.equal(
    replyKey("Where is the contact page?", page),
    replyKey("where is the Contact page", page),
  );
  assert.notEqual(
    replyKey("Where is the contact page?", page),
    replyKey("Where is the cart?", page),
  );

  const changed = { ...page, content: "[m1 link: Contact] Sale ends today." };
  assert.notEqual(
    replyKey("Where is the contact page?", page),
    replyKey("Where is the contact page?", changed),
  );
  assert.notEqual(
    replyKey("Where is the contact page?", page),
    replyKey("Where is the contact page?", null),
  );
});
