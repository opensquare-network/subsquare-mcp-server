import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "../src/mcp.js";
import { ApiRequestError, request } from "../src/services/api.js";

const address = "fixture-address";
const emptyPage = { page: 1, pageSize: 25, total: 0, items: [] };

async function connect(t) {
  const server = createMcpServer();
  const client = new Client({ name: "contract-test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  t.after(async () => {
    await client.close();
    await server.close();
  });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return client;
}

async function call(client, name, args) {
  const result = await client.callTool({ name, arguments: args });
  assert.ok(!result.isError, result.content[0]?.text);
  return result.structuredContent;
}

async function expectToolError(client, name, args, message) {
  const result = await client.callTool({ name, arguments: args });
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, message);
}

test("Hydration routes only OpenGov votes and applies their vote type", async (t) => {
  const get = t.mock.method(request, "get", async (url) => {
    assert.equal(url.hostname, "hydration-api.subsquare.io");
    assert.equal(url.pathname, `/users/${address}/referenda/votes`);
    assert.equal(url.searchParams.get("type"), "aye");
    return { ...emptyPage, total: 1, items: [{ referendumIndex: 7 }] };
  });
  const client = await connect(t);
  const args = { chain: "hydration", address, kind: "votes", module: "referenda" };
  const result = await call(client, "list_user_voting", { ...args, type: "aye" });
  assert.deepEqual(result.data, [{ referendumIndex: 7 }]);

  for (const overrides of [{ kind: "vote_calls" }, { module: "democracy" }]) {
    await expectToolError(
      client,
      "list_user_voting",
      { ...args, ...overrides },
      /\[unsupported_chain\].*Hydration only supports OpenGov votes/,
    );
  }
  assert.equal(get.mock.callCount(), 1);
});

test("user vote title enrichment can be disabled without changing vote calls", async (t) => {
  const get = t.mock.method(request, "get", async () => emptyPage);
  const client = await connect(t);
  const votes = { address, module: "referenda", kind: "votes" };

  await call(client, "list_user_voting", { ...votes, includes_title: false });
  await call(client, "list_user_voting", votes);
  await call(client, "list_user_voting", { ...votes, kind: "vote_calls" });

  const path = `/users/${address}/referenda`;
  assert.deepEqual(
    get.mock.calls.map(({ arguments: [url] }) => [
      url.pathname,
      url.searchParams.get("includes_title"),
    ]),
    [[`${path}/votes`, null], [`${path}/votes`, "1"], [`${path}/vote-calls`, "1"]],
  );
});

test("delegation views preserve their original default page sizes", async (t) => {
  t.mock.method(request, "get", async (url, query) => {
    if (url.pathname === `/users/${address}/referenda/delegators`) {
      return [];
    }
    if (url.pathname === "/referenda/tracks/0/delegatee") {
      assert.deepEqual(query, {
        page: 1, page_size: 25, sort: JSON.stringify(["delegatorsCount", "asc"]),
      });
      return {
        ...emptyPage,
        total: 1,
        items: [{ account: address, trackId: 0, delegatorsCount: 2, delegatedVotes: "3" }],
      };
    }
    assert.ok(
      ["/delegation/referenda/delegates", "/referenda/tracks/0/delegators"].includes(url.pathname),
    );
    return { ...emptyPage, page: query.page, pageSize: query.page_size };
  });
  const client = await connect(t);
  const list = (args) => call(client, "opengov_list_delegations", { chain: "polkadot", ...args });

  assert.equal((await list({ view: "delegates" })).pageSize, 25);
  assert.equal((await list({ view: "track", track_id: 0 })).pageSize, 25);
  assert.equal((await list({ view: "delegators", address })).pageSize, 100);
  const custom = await list({ view: "track", track_id: 0, page: 2, page_size: 10 });
  assert.equal(custom.page, 2);
  assert.equal(custom.pageSize, 10);
  const { items } = await list({
    view: "track_delegatees", track_id: 0, sort_by: "delegatorsCount", sort_order: "asc",
  });
  assert.deepEqual(items, [{
    account: address, trackId: 0, delegatorsCount: 2, delegatedCapital: null, delegatedVotes: "3",
  }]);
});

test("Collectives proposer errors point to a working Fellowship query", async (t) => {
  const get = t.mock.method(request, "get", async (url) => {
    assert.equal(url.hostname, "collectives-api.subsquare.io");
    assert.equal(url.pathname, `/users/${address}/fellowship/referendums`);
    return emptyPage;
  });
  const client = await connect(t);
  await expectToolError(
    client,
    "opengov_list_referenda",
    { chain: "collectives", proposer: address },
    /fellowship_list_address_activity.*kind=referenda/,
  );
  await call(client, "fellowship_list_address_activity", { kind: "referenda", address });
  assert.equal(get.mock.callCount(), 1);
});

test("referenda summaries are opt-in, reused by chain, and explicitly unavailable on failure", async (t) => {
  const summaryRequests = [];
  t.mock.method(request, "get", async (url, query) => {
    if (url.pathname === "/gov2/referendums/summary") {
      summaryRequests.push(url.hostname);
      if (url.hostname === "kusama-api.subsquare.io") {
        throw new ApiRequestError("Fixture summary unavailable", { status: 503 });
      }
      return { approved: 3 };
    }
    assert.equal(url.pathname, "/gov2/referendums");
    assert.ok(!("include_summary" in query));
    return { ...emptyPage, page: query.page };
  });
  const warn = t.mock.method(console, "warn", () => {});
  const client = await connect(t);
  const list = (args) => call(client, "opengov_list_referenda", args);

  const defaultPage = await list({ chain: "polkadot" });
  assert.equal(defaultPage.summary, null);
  assert.equal(defaultPage.summaryStatus, "not_requested");
  assert.deepEqual(summaryRequests, []);

  const pages = await Promise.all(
    [1, 2].map((page) => list({ chain: "polkadot", page, include_summary: true })),
  );
  assert.deepEqual(pages.map(({ page }) => page), [1, 2]);
  for (const result of pages) {
    assert.deepEqual(result.summary, { approved: 3 });
    assert.equal(result.summaryStatus, "available");
  }
  assert.deepEqual(summaryRequests, ["polkadot-api.subsquare.io"]);

  const unavailable = await list({ chain: "kusama", include_summary: true });
  assert.equal(unavailable.summary, null);
  assert.equal(unavailable.summaryStatus, "unavailable");
  assert.deepEqual(summaryRequests, ["polkadot-api.subsquare.io", "kusama-api.subsquare.io"]);
  assert.equal(warn.mock.callCount(), 1);
});

test("standalone referenda summary skips a failing list and shares the summary cache", async (t) => {
  const chain = "collectives";
  const listPath = "/fellowship/referenda";
  const summaryPath = `${listPath}/summary`;
  const summary = { approved: 3 };
  const get = t.mock.method(request, "get", async (url) => {
    if (url.pathname === summaryPath) {
      return summary;
    }
    if (url.pathname === listPath) {
      throw new ApiRequestError("Fixture referenda list unavailable", { status: 503 });
    }
    assert.equal(url.pathname, "/gov2/referendums/summary");
    throw new ApiRequestError("Fixture summary unavailable", { status: 503 });
  });
  const client = await connect(t);

  assert.deepEqual(await call(client, "opengov_referenda_summary", { chain }), summary);
  assert.equal(get.mock.callCount(), 1);
  await expectToolError(
    client,
    "opengov_list_referenda",
    { chain, include_summary: true },
    /Fixture referenda list unavailable/,
  );
  await expectToolError(
    client,
    "opengov_referenda_summary",
    { chain: "hydration" },
    /Fixture summary unavailable/,
  );
  assert.deepEqual(
    get.mock.calls.map((entry) => entry.arguments[0].pathname),
    [summaryPath, listPath, "/gov2/referendums/summary"],
  );
});

test("standalone user vote stats do not load profile or counts", async (t) => {
  const statsPath = `/users/${address}/referenda/vote-stats`;
  const source = `https://polkadot-api.subsquare.io${statsPath}`;
  const stats = { aye: 7 };
  let statsUnavailable = false;
  const get = t.mock.method(request, "get", async (url) => {
    if (url.toString() !== source) {
      throw new ApiRequestError("Fixture user profile or counts unavailable", { status: 503 });
    }
    if (statsUnavailable) {
      throw new ApiRequestError("Fixture vote stats unavailable", { status: 503 });
    }
    return stats;
  });
  const client = await connect(t);
  const args = { address, modules: ["referenda"] };

  assert.deepEqual(await call(client, "get_user_vote_stats", args), {
    chain: "polkadot",
    address,
    detail: `https://polkadot.subsquare.io/users/${address}`,
    source: [source],
    pagination: null,
    data: { voteStats: { referenda: { supported: true, source, data: stats } } },
  });
  statsUnavailable = true;
  await expectToolError(client, "get_user_vote_stats", args, /Fixture vote stats unavailable/);
  assert.deepEqual(get.mock.calls.map((entry) => entry.arguments[0].toString()), [source, source]);
});

test("standalone native bounty statistics do not load bounty details", async (t) => {
  const statsPath = "/treasury/bounties/0/statistics";
  const statistics = { bountyId: 0, categories: {}, curators: {}, beneficiaries: {} };
  let statsUnavailable = false;
  const get = t.mock.method(request, "get", async (url) => {
    assert.equal(url.hostname, "polkadot-api.subsquare.io");
    if (url.pathname !== statsPath) {
      throw new ApiRequestError("Fixture bounty details unavailable", { status: 503 });
    }
    if (statsUnavailable) {
      throw new ApiRequestError("Fixture bounty statistics unavailable", { status: 503 });
    }
    return statistics;
  });
  const client = await connect(t);
  const args = { bounty_index: 0 };

  assert.deepEqual(await call(client, "bounties_get_bounty_statistics", args), { statistics });
  statsUnavailable = true;
  await expectToolError(
    client,
    "bounties_get_bounty_statistics",
    args,
    /Fixture bounty statistics unavailable/,
  );
  assert.deepEqual(
    get.mock.calls.map((entry) => entry.arguments[0].pathname),
    [statsPath, statsPath],
  );
});

test("Treasury project listing is compact and the ID resolves to linked details", async (t) => {
  const get = t.mock.method(request, "get", async (url) => {
    switch (url.pathname) {
      case "/treasury/status/projects":
        return [{ id: "nova", name: "Nova", proposals: [{ id: 7, proportion: 1 }] }];
      case "/treasury/proposals/7":
        return { title: "Fixture proposal", dValue: "10" };
      default:
        assert.fail(`Unexpected Treasury endpoint: ${url.pathname}`);
    }
  });
  const client = await connect(t);
  const args = { chain: "polkadot", kind: "projects" };
  await expectToolError(
    client,
    "treasury_list",
    { ...args, page_size: 1 },
    /\[unsupported_filter\].*page_size.*all projects/,
  );
  assert.equal(get.mock.callCount(), 0);

  const { projects } = await call(client, "treasury_list", args);
  assert.deepEqual(projects, [{ id: "nova", name: "Nova" }]);
  const detail = await client.callTool({
    name: "treasury_get_project_detail",
    arguments: { project_id: projects[0].id },
  });
  assert.ok(!detail.isError, detail.content[0]?.text);
  assert.equal(detail.structuredContent.proposals[0].detail.title, "Fixture proposal");
  assert.deepEqual(JSON.parse(detail.content[0].text), detail.structuredContent);
});

test("paginated Treasury, track delegatee, bounty, and Fellowship modes reject incomplete upstream pages", async (t) => {
  const chain = "polkadot";
  const api = "https://polkadot-api.subsquare.io";
  const cases = [
    ["treasury_list", { chain, kind: "tips" }, "/treasury/tips", "items"],
    ["treasury_get", { chain, view: "burn" }, "/treasury/burnt", "pageSize", { totalBurnt: "0" }],
    [
      "treasury_list",
      { chain, kind: "beneficiaries", sort_by: "awarded_value" },
      "/treasury/beneficiaries",
      "total",
      { chain, source: `${api}/treasury/beneficiaries` },
    ],
    [
      "opengov_list_delegations",
      { chain, view: "track_delegatees", track_id: 0 },
      "/referenda/tracks/0/delegatee",
      "page",
      { chain, trackId: 0, source: `${api}/referenda/tracks/0/delegatee` },
    ],
    [
      "bounties_list",
      { chain, bounty_type: "multi_asset", status: "inactive" },
      "/treasury/multi-asset-bounties/inactive",
      "total",
    ],
    ["fellowship_list", { kind: "applications" }, "/fellowship/applications", "items"],
  ];
  const pages = new Map(cases.map(([, , path, field]) => {
    const page = { ...emptyPage };
    delete page[field];
    return [path, page];
  }));
  t.mock.method(request, "get", async (url, query) => {
    if (url.pathname === "/treasury/burnt/summary") {
      return { totalBurnt: "0" };
    }
    if (url.pathname === "/treasury/beneficiaries") {
      assert.deepEqual(query, { page: 1, page_size: 25, sort_by: "awarded_value" });
    }
    assert.ok(pages.has(url.pathname), `Unexpected page endpoint: ${url.pathname}`);
    return pages.get(url.pathname);
  });
  const client = await connect(t);

  for (const [name, args, path, field, extras] of cases) {
    await expectToolError(
      client,
      name,
      args,
      new RegExp(`\\[invalid_upstream_response\\].*${field}:`),
    );
    pages.set(path, emptyPage);
    const result = await call(client, name, args);
    assert.deepEqual(JSON.parse(JSON.stringify(result)), { ...emptyPage, ...extras });
  }
});

test("account assets and activity use their own pagination parameters", async (t) => {
  const post = t.mock.method(request, "post", async (_url, { variables }) => {
    assert.deepEqual(variables, { address, limit: 5, offset: 15 });
    return { data: { accountAssets: { holders: [], limit: 5, offset: 15, total: 0 } } };
  });
  const get = t.mock.method(request, "get", async (url, query) => {
    assert.equal(url.pathname, `/accounts/${address}/transfers`);
    assert.deepEqual(query, { page: 0, page_size: 25 });
    return { ...emptyPage, page: 0 };
  });
  const client = await connect(t);
  const assets = { kind: "assets", chain: "polkadotAssetHub", address };
  const transfers = { kind: "transfers", chain: "polkadot", address };
  await expectToolError(
    client, "account_list", { ...assets, page: 2 }, /\[unsupported_filter\].*Use limit and offset/,
  );
  await expectToolError(
    client, "account_list", { ...transfers, offset: 0 }, /\[unsupported_filter\].*Use page and page_size/,
  );
  assert.equal(post.mock.callCount(), 0);
  assert.equal(get.mock.callCount(), 0);

  const assetPage = await call(client, "account_list", { ...assets, limit: 5, offset: 15 });
  assert.equal(assetPage.offset, 15);
  const transferPage = await call(client, "account_list", transfers);
  assert.equal(transferPage.page, 0);
});

test("StateScan validates page fields while block lists may omit total", async (t) => {
  const chain = "polkadot";
  const blockPage = { page: 0, pageSize: 10, items: [] };
  let events = { page: 0, items: [] };
  t.mock.method(request, "get", async (url) => {
    if (url.pathname === "/events") {
      return events;
    }
    assert.equal(url.pathname, `/accounts/${address}/transfers`);
    return { page: 0, pageSize: 25, total: 0 };
  });
  t.mock.method(request, "post", async () => ({
    data: { accountAssets: { limit: 25, offset: 0, total: 0 } },
  }));
  const client = await connect(t);
  const blocks = { chain, kind: "events" };

  await expectToolError(client, "block_list", blocks, /\[invalid_upstream_response\].*pageSize:/);
  events = blockPage;
  assert.deepEqual(await call(client, "block_list", blocks), { ...blockPage, identities: {} });

  await expectToolError(
    client, "account_list", { chain, address, kind: "transfers" }, /\[invalid_upstream_response\].*items:/,
  );
  await expectToolError(
    client, "account_list", { chain: "polkadotAssetHub", address, kind: "assets" },
    /\[invalid_upstream_response\].*holders:/,
  );
});

test("merged modes reject arguments they cannot apply, even when set to false or zero", async (t) => {
  const get = t.mock.method(request, "get", () => assert.fail("Unexpected upstream call"));
  const client = await connect(t);
  const chain = "polkadot";
  const cases = [
    ["list_user_voting", { chain, address, module: "referenda", kind: "vote_calls", type: "aye" }, "type"],
    ["list_user_voting", { chain, address, module: "referenda", kind: "vote_calls", includes_title: false }, "includes_title"],
    ["treasury_get", { chain, view: "status", include_history: false }, "include_history"],
    ["treasury_list", { chain, kind: "tips", sort_by: "awarded_value" }, "sort_by"],
    ["bounties_list", { chain, bounty_type: "multi_asset", page: 1 }, "page"],
    ["bounties_get", { chain, bounty_type: "multi_asset", bounty_id: 0, include_statistics: false }, "include_statistics"],
    ["opengov_list_delegations", { chain, view: "delegates", track_id: 0 }, "track_id"],
    ["opengov_list_delegations", { chain, view: "track", track_id: 0, sort_order: "asc" }, "sort_order"],
    ["list_referendum_votes", { chain, referendum_type: "opengov", referendum_index: 0, tally_limit: 2 }, "tally_limit"],
    ["fellowship_list", { kind: "members", page: 1 }, "page"],
    ["fellowship_list_address_activity", { kind: "referenda", address, includes_title: false }, "includes_title"],
    ["fellowship_salary", { kind: "overview", address }, "address"],
  ];
  for (const [name, args, invalidArg] of cases) {
    await expectToolError(client, name, args, new RegExp(`\\[unsupported_filter\\].*${invalidArg}`));
  }
  assert.equal(get.mock.callCount(), 0);
});

test("non-paginated Secretary and Fellowship Treasury tools reject pagination", async (t) => {
  const get = t.mock.method(request, "get", () => assert.fail("Unexpected upstream call"));
  const client = await connect(t);
  await expectToolError(
    client, "secretary_list", { kind: "members", page: 2 }, /Input validation error.*page/,
  );
  await expectToolError(
    client, "fellowship_treasury_get", { view: "status", page: 2 }, /Input validation error.*page/,
  );
  assert.equal(get.mock.callCount(), 0);
});

test("tool discovery describes project lookup, pagination, amount units, and Vesting cursors", async (t) => {
  const client = await connect(t);
  const { tools } = await client.listTools();
  const tool = (name) => tools.find((entry) => entry.name === name);
  const projectId = tool("treasury_get_project_detail").inputSchema.properties.project_id;
  assert.match(projectId.description, /treasury_list.*kind=projects/);
  const account = tool("account_list").outputSchema.properties;
  assert.ok(account.pageSize && account.offset && account.total);
  const vesting = tool("list_vesting_accounts").outputSchema.properties;
  assert.match(vesting.nextCursor.description, /last page/);
  assert.match(vesting.items.items.properties.unlockable.description, /smallest units|balance/i);
});

test("governance search routes both modes and rejects non-Polkadot full-text searches", async (t) => {
  let fullText = { items: [{ title: "Budget", content: "Account funding" }], projects: [], wiki: [] };
  const get = t.mock.method(request, "get", async (url, query) => {
    if (url.pathname === "/search") {
      assert.equal(url.hostname, "kusama-api.subsquare.io");
      assert.deepEqual(query, { text: "Budget", max: 10 });
      return { openGovReferenda: [{ referendumIndex: 0, title: "Budget" }] };
    }
    assert.equal(url.pathname, "/search/full-text");
    assert.equal(url.hostname, "polkadot-api.subsquare.io");
    assert.deepEqual(query, { text: "Budget", max: 4 });
    return fullText;
  });
  const client = await connect(t);
  await expectToolError(
    client, "gov_search", { chain: "kusama", mode: "full_text", text: "Budget" },
    /\[unsupported_chain\].*mode=keyword/,
  );
  assert.equal(get.mock.callCount(), 0);

  const keyword = await call(client, "gov_search", { chain: "kusama", text: " Budget " });
  assert.equal(keyword.results.openGovReferenda[0].url, "https://kusama.subsquare.io/referenda/referendum/0");

  const args = { chain: "polkadot", mode: "full_text", text: "Budget", max: 4 };
  const result = await client.callTool({ name: "gov_search", arguments: args });
  assert.ok(!result.isError, result.content[0]?.text);
  assert.equal(result.structuredContent.items[0].content, "Account funding");
  assert.deepEqual(JSON.parse(result.content[0].text), result.structuredContent);
  fullText = { projects: [], wiki: [] };
  await expectToolError(client, "gov_search", args, /\[invalid_upstream_response\].*items/);
});

test("referendum vote type selects the route independently of the chain", async (t) => {
  let tally = [
    { indexer: { blockHeight: 1 }, tally: { ayes: "0x2", nays: "0x2" } },
    { indexer: { blockHeight: 2 }, tally: { ayes: "0x3", nays: "0x1" } },
  ];
  const get = t.mock.method(request, "get", async (url) => {
    assert.equal(url.hostname, "kusama-api.subsquare.io");
    switch (url.pathname) {
      case "/gov2/referenda/0/votes":
        return [
          { account: "low", aye: false, balance: "4", votes: "4" },
          { account: "high", aye: true, balance: "90071992547409930", votes: "90071992547409930" },
        ];
      case "/gov2/referendums/0/vote-stats":
        return { electorate: "100000000000000000" };
      case "/fellowship/referenda/0/votes":
        return [{ account: address, isAye: true, votes: 3 }];
      case "/fellowship/referenda/0/tally-history":
        return tally;
      default:
        assert.fail(`Unexpected vote endpoint: ${url.pathname}`);
    }
  });
  const client = await connect(t);
  const args = { chain: "kusama", referendum_type: "opengov", referendum_index: 0, page_size: 1 };
  await expectToolError(
    client, "list_referendum_votes", { ...args, chain: "collectives" },
    /\[unsupported_chain\].*polkadot, kusama, hydration/,
  );
  assert.equal(get.mock.callCount(), 0);
  const opengov = await call(client, "list_referendum_votes", args);
  assert.deepEqual(opengov.items.map(({ account }) => account), ["high"]);
  assert.equal(opengov.total, 2);
  assert.equal(opengov.summary.totalVotes, "90071992547409934");
  assert.equal(opengov.stats.electorate, "100000000000000000");
  assert.equal(opengov.tallyHistory, null);

  const fellowshipArgs = {
    ...args, referendum_type: "fellowship", include_tally_history: true, tally_limit: 1,
  };
  const fellowship = await call(client, "list_referendum_votes", fellowshipArgs);
  assert.equal(fellowship.stats, null);
  assert.equal(fellowship.summary.aye, 1);
  assert.equal(fellowship.tallyHistory.total, 2);
  assert.deepEqual(fellowship.tallyHistory.items.map(({ blockHeight, ayes, approvalPercent }) =>
    [blockHeight, ayes, approvalPercent]), [[2, "3", 75]]);

  tally = null;
  await expectToolError(
    client, "list_referendum_votes", fellowshipArgs, /\[invalid_upstream_response\].*tally history/,
  );
});

test("beneficiary activity validates each requested page rather than fabricating empty results", async (t) => {
  let spends = { page: 2, pageSize: 1, items: [] };
  t.mock.method(request, "get", async (url, query) => {
    switch (url.pathname) {
      case `/treasury/beneficiaries/${address}`:
        return { address, spends: { benefitCount: 2 } };
      case `/beneficiaries/${address}/treasury-spends`:
        assert.deepEqual(query, { page: 2, page_size: 1 });
        return spends;
      default:
        assert.fail(`Unexpected benefit endpoint: ${url.pathname}`);
    }
  });
  const client = await connect(t);
  const args = {
    chain: "polkadot", address, modules: ["treasury_spends"], page: 2, page_size: 1,
  };
  await expectToolError(
    client, "get_address_treasury_benefits", args, /\[invalid_upstream_response\].*total:/,
  );
  spends = { ...spends, total: 2, items: [{ index: 4, title: "Spend" }] };
  const benefits = await call(client, "get_address_treasury_benefits", args);
  assert.equal(benefits.summary.spends.benefitCount, 2);
  assert.equal(benefits.modules[0].items[0].url, "https://polkadot.subsquare.io/treasury/spends/4");
});

test("referendum details look up preimages only on request and share the standalone lookup", async (t) => {
  const hash = `0x${"a".repeat(64)}`;
  const referendum = { onchainData: { proposalHash: hash } };
  const preimage = { decoded: { calls: [{ method: "fixture" }] } };
  let preimageStatus = 200;
  const get = t.mock.method(request, "get", async (url) => {
    if (url.pathname === "/gov2/referendums/0") {
      return referendum;
    }
    assert.equal(url.pathname, `/preimages/${hash}`);
    if (preimageStatus !== 200) {
      throw new ApiRequestError("Fixture preimage lookup failed", { status: preimageStatus });
    }
    return preimage;
  });
  const client = await connect(t);
  const chain = "polkadot";
  const detail = (args = {}) =>
    call(client, "opengov_referendum_detail", { chain, referendum_index: 0, ...args });
  assert.deepEqual(await detail(), referendum);
  assert.equal(get.mock.callCount(), 1);
  assert.deepEqual((await detail({ resolve_preimage: true })).preimage, preimage);
  assert.deepEqual((await call(client, "get_preimage", { chain, hash })).preimage, preimage);

  preimageStatus = 404;
  assert.equal((await detail({ resolve_preimage: true })).preimage, null);
  assert.equal((await call(client, "get_preimage", { chain, hash })).found, false);
  preimageStatus = 503;
  await expectToolError(client, "get_preimage", { chain, hash }, /Fixture preimage lookup failed/);
});

test("track statistics and turnout keep their distinct upstream records", async (t) => {
  t.mock.method(request, "get", async (url) => {
    switch (url.pathname) {
      case "/referenda/summary":
        return {
          trackTurnouts: [{ id: 0, name: "Root", percentage: 0.2 }],
          trackReferendaCounts: [{ id: 0, count: 10 }],
          delegation: {},
        };
      case "/referenda/tracks":
        return [{ trackId: 0, statistics: { votes: { capital: "42" } } }];
      case "/referenda/tracks/0/turnout":
        return [{ referendumIndex: 2 }, { referendumIndex: 3, ayes: "3", nays: "1" }];
      default:
        assert.fail(`Unexpected track endpoint: ${url.pathname}`);
    }
  });
  const client = await connect(t);
  const chain = "polkadot";
  const stats = await call(client, "opengov_list_track_statistics", { chain });
  assert.equal(stats.delegation, null);
  assert.deepEqual(
    stats.items.map(({ trackId, turnoutPercent, referendaCount, delegatedCapital }) =>
      [trackId, turnoutPercent, referendaCount, delegatedCapital]),
    [[0, 20, 10, "42"]],
  );
  const turnout = await call(client, "opengov_get_track_turnout", { chain, track_id: 0, limit: 1 });
  assert.equal(turnout.total, 2);
  assert.deepEqual(turnout.items.map(({ referendumIndex, approvalPercent }) =>
    [referendumIndex, approvalPercent]), [[3, 75]]);
});

test("Collectives overview includes its Fellowship tracks in structured output", async (t) => {
  t.mock.method(request, "get", async (url) => {
    assert.equal(url.hostname, "collectives-api.subsquare.io");
    assert.equal(url.pathname, "/overview/recent/summary");
    return {
      fellowshipReferenda: { active: 3 },
      fellowshipReferendaTracks: [{ id: 1, name: "Rank 1", activeCount: 3 }],
    };
  });
  const client = await connect(t);
  const { tracks, modules } = await call(client, "gov_overview", { chain: "collectives", recent: true });
  assert.deepEqual(tracks, [{ id: 1, name: "Rank 1", activeCount: 3 }]);
  assert.deepEqual(modules, [{ module: "fellowshipReferenda", active: 3, all: null }]);
});

test("governance event windows are inclusive and invalid timestamps fail before an upstream call", async (t) => {
  const time = Date.parse("2026-11-01T00:00:00Z");
  const get = t.mock.method(request, "get", async (url, query) => {
    assert.equal(url.pathname, "/events/summary");
    assert.deepEqual(query, { begin_time: time, end_time: time });
    return [{ type: "referenda_approved", category: "OpenGov", indexer: { blockTime: time } }];
  });
  const client = await connect(t);
  const args = { chain: "polkadot", begin_time: "2026-11-01T00:00:00Z", end_time: time };
  await expectToolError(
    client, "list_gov_events", { ...args, end_time: 8_640_000_000_000_001 }, /\[invalid_time\].*end_time/,
  );
  assert.equal(get.mock.callCount(), 0);
  const events = await call(client, "list_gov_events", args);
  assert.deepEqual(events.items.map(({ blockTime }) => blockTime), [time]);
  assert.equal(events.truncated, false);
});
