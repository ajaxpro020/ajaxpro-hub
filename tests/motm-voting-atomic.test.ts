import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

type State = { open: boolean; closesAt: number; vote?: string };

class LockedVoteStore {
  private tail = Promise.resolve();
  readonly state: State;

  constructor(state: State) { this.state = state; }

  private transaction<T>(work: () => T | Promise<T>) {
    const result = this.tail.then(work);
    this.tail = result.then(() => undefined, () => undefined);
    return result;
  }

  vote(playerId: string, databaseNow: number) {
    return this.transaction(() => {
      if (!this.state.open || this.state.closesAt <= databaseNow) return false;
      this.state.vote = playerId;
      return true;
    });
  }

  close() {
    return this.transaction(() => { this.state.open = false; });
  }
}

test("atomische stemquery lockt de wedstrijd en gebruikt de databaseklok", () => {
  const source = readFileSync(new URL("../lib/motm-voting.ts", import.meta.url), "utf8");
  assert.match(source, /sql\.begin|\.begin/);
  const lockIndex = source.indexOf("FOR UPDATE");
  const clockIndex = source.indexOf("clock_timestamp()");
  assert.ok(lockIndex >= 0);
  assert.ok(clockIndex > lockIndex, "de databaseklok moet pas na het verkrijgen van de row lock worden gelezen");
  assert.match(source, /status = 'open' AND scheduled_close_at > clock_timestamp\(\)/);
  assert.match(source, /SELECT 1[\s\S]*motm_match_players/);
  assert.match(source, /ON CONFLICT\(match_id, voter_discord_user_id\)/);
  assert.match(source, /motm_vote_rate_limits/);
  assert.match(source, /MOTM_VOTE_RATE_LIMIT_SECONDS/);
});

test("een normale geldige stem wordt opgeslagen", async () => {
  const store = new LockedVoteStore({ open: true, closesAt: 100 });
  assert.equal(await store.vote("a", 50), true);
  assert.equal(store.state.vote, "a");
});

test("een bestaande stem kan worden gewijzigd terwijl de stemming open is", async () => {
  const store = new LockedVoteStore({ open: true, closesAt: 100, vote: "a" });
  assert.equal(await store.vote("b", 60), true);
  assert.equal(store.state.vote, "b");
});

test("een stem op of na de sluitingstijd wordt geweigerd", async () => {
  const store = new LockedVoteStore({ open: true, closesAt: 100 });
  assert.equal(await store.vote("a", 100), false);
  assert.equal(store.state.vote, undefined);
});

test("een sluittransactie die de lock eerst krijgt blokkeert de gelijktijdige stem", async () => {
  const store = new LockedVoteStore({ open: true, closesAt: 100 });
  const closing = store.close();
  const voting = store.vote("a", 90);
  await closing;
  assert.equal(await voting, false);
  assert.equal(store.state.vote, undefined);
});

test("parallelle stemrequests rond sluiting accepteren niets na de sluittransactie", async () => {
  const store = new LockedVoteStore({ open: true, closesAt: 100 });
  const before = [store.vote("a", 99), store.vote("b", 99)];
  const closing = store.close();
  const after = [store.vote("c", 99), store.vote("d", 101), store.vote("e", 101)];
  assert.deepEqual(await Promise.all(before), [true, true]);
  await closing;
  assert.deepEqual(await Promise.all(after), [false, false, false]);
  assert.equal(store.state.vote, "b");
});

test("de POST-route vertaalt een gesloten transactie naar 409", () => {
  const source = readFileSync(new URL("../api-impl/motm/vote.ts", import.meta.url), "utf8");
  assert.match(source, /result === "closed"[\s\S]*409/);
  assert.doesNotMatch(source, /const now = new Date\(\)[\s\S]*canVoteAt/);
});

test("de POST-route vertaalt een te snelle stem naar 429", () => {
  const source = readFileSync(new URL("../api-impl/motm/vote.ts", import.meta.url), "utf8");
  assert.match(source, /result === "rate_limited"[\s\S]*429/);
  assert.match(source, /Retry-After/);
});

test("de rate limit is per wedstrijd en Discord-gebruiker en staat database-atomisch", () => {
  const source = readFileSync(new URL("../lib/motm-voting.ts", import.meta.url), "utf8");
  assert.match(source, /PRIMARY KEY \(match_id, voter_discord_user_id\)|ON CONFLICT\(match_id, voter_discord_user_id\)/);
  assert.match(source, /WHERE motm_vote_rate_limits\.last_attempt_at <= clock_timestamp\(\)/);
  assert.match(source, /RETURNING 1/);
});

test("rate-limitgedrag laat normale stemmen, wijzigingen en verschillende sleutels toe", async () => {
  const intervalMs = 5_000;
  const lastAttempt = new Map<string, number>();
  const allow = (matchId: string, userId: string, now: number) => {
    const key = `${matchId}:${userId}`;
    const previous = lastAttempt.get(key);
    if (previous !== undefined && now - previous < intervalMs) return false;
    lastAttempt.set(key, now);
    return true;
  };

  assert.equal(allow("match-a", "user-a", 1_000), true, "eerste stem mag door");
  assert.equal(allow("match-a", "user-a", 1_001), false, "snelle wijziging wordt beperkt");
  assert.equal(allow("match-a", "user-a", 6_000), true, "normale latere wijziging mag door");
  assert.equal(allow("match-a", "user-b", 1_001), true, "andere gebruiker heeft een eigen limiet");
  assert.equal(allow("match-b", "user-a", 1_001), true, "andere wedstrijd heeft een eigen limiet");
});

test("gelijktijdige limiterchecks voor dezelfde gebruiker en wedstrijd accepteren er maximaal één", async () => {
  let lastAttempt: number | undefined;
  const consume = async (now: number) => {
    await Promise.resolve();
    if (lastAttempt !== undefined && now - lastAttempt < 5_000) return false;
    lastAttempt = now;
    return true;
  };
  const results = await Promise.all([consume(1_000), consume(1_000)]);
  assert.deepEqual(results.sort(), [false, true]);
});

test("MOTM-stemroute gebruikt een harde body- en field-limiet vóór bestaande validatie", () => {
  const source = readFileSync(new URL("../api-impl/motm/vote.ts", import.meta.url), "utf8");
  assert.match(source, /readFormDataWithLimits/);
  assert.match(source, /MOTM_VOTE_MAX_BODY_BYTES/);
  assert.match(source, /MOTM_VOTE_MAX_FORM_FIELDS/);
});
