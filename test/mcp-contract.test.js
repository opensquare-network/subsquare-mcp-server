import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "../src/mcp.js";
import { ApiRequestError, request } from "../src/services/api.js";
import { listMultiAssetChildBounties } from "../src/services/treasury/bounties.js";

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

test("referendum comments reject legacy pagination and Polkassembly options", async (t) => {
  const commentsPath = "/gov2/referendums/fixture-referendum/comments";
  const get = t.mock.method(request, "get", async (url, query) => {
    switch (url.pathname) {
      case "/gov2/referendums/7":
        return { _id: "fixture-referendum", polkassemblyId: 7, polkassemblyPostType: "referendum" };
      case commentsPath:
        return { ...emptyPage, pageSize: query.page_size, total: 1, items: [{ _id: "comment" }] };
      case "/polkassembly-comments":
        return [{ id: "polkassembly-comment" }];
      case "/polkassembly-comments/referendum/7/replies":
        return {};
      default:
        assert.fail(`Unexpected comment endpoint: ${url.pathname}`);
    }
  });
  const client = await connect(t);
  const args = { chain: "polkadot", referendum_type: "opengov", referendum_index: 7 };

  await expectToolError(
    client,
    "list_referendum_comments",
    { ...args, pageSize: 1, includePolkassembly: false },
    /Input validation error[\s\S]*pageSize[\s\S]*includePolkassembly/,
  );
  assert.equal(get.mock.callCount(), 0);

  const result = await call(client, "list_referendum_comments", {
    ...args,
    page_size: 1,
    include_polkassembly: false,
  });
  assert.equal(result.pageSize, 1);
  assert.deepEqual(result.items.map(({ comment_source }) => comment_source), ["subsquare"]);
  assert.deepEqual(
    get.mock.calls.map(({ arguments: [url] }) => url.pathname),
    ["/gov2/referendums/7", commentsPath],
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
      throw new ApiRequestError("Fixture vote stats rate limited", { status: 429 });
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
  assert.deepEqual(await call(client, "get_user_vote_stats", args), {
    chain: "polkadot",
    address,
    source: [source],
    pagination: null,
    data: null,
    error: {
      code: "request_failed",
      reason: null,
      message: "Fixture vote stats rate limited",
      status: 429,
      endpoint: source,
    },
  });
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

test("paginated Treasury, bounty, and Fellowship modes reject incomplete upstream pages", async (t) => {
  const chain = "polkadot";
  const cases = [
    ["treasury_list", { chain, kind: "tips" }, "/treasury/tips", "items"],
    ["treasury_get", { chain, view: "burn" }, "/treasury/burnt", "pageSize"],
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
  t.mock.method(request, "get", async (url) => {
    if (url.pathname === "/treasury/burnt/summary") {
      return { totalBurnt: "0" };
    }
    assert.ok(pages.has(url.pathname), `Unexpected page endpoint: ${url.pathname}`);
    return pages.get(url.pathname);
  });
  const client = await connect(t);

  for (const [name, args, path, field] of cases) {
    await expectToolError(
      client,
      name,
      args,
      new RegExp(`\\[invalid_upstream_response\\].*${field}:`),
    );
    pages.set(path, emptyPage);
    const result = await call(client, name, args);
    const expected = name === "treasury_get" ? { ...emptyPage, totalBurnt: "0" } : emptyPage;
    assert.deepEqual(JSON.parse(JSON.stringify(result)), expected);
  }
});

test("multi-asset child bounty lookups by ids require an array rather than a page", async (t) => {
  const ids = "1_2_3";
  const item = { parentBountyId: 1, childBountyId: 2 };
  let response = [item];
  const get = t.mock.method(request, "get", async (url) => {
    assert.equal(url.pathname, "/treasury/multi-asset-child-bounties");
    return response;
  });

  assert.deepEqual(await listMultiAssetChildBounties({ ids }), [item]);
  assert.equal(get.mock.calls[0].arguments[1].ids, ids);
  response = [];
  assert.deepEqual(await listMultiAssetChildBounties({ ids }), []);
  await assert.rejects(
    listMultiAssetChildBounties(),
    /\[invalid_upstream_response\].*pagination/,
  );

  response = emptyPage;
  assert.deepEqual(await listMultiAssetChildBounties({ ids: "" }), emptyPage);
  await assert.rejects(
    listMultiAssetChildBounties({ ids }),
    /\[invalid_upstream_response\].*ids.*array/,
  );
});

test("Coretime sale lists reject invalid items and totals but accept empty pages", async (t) => {
  let sales = { total: 3, items: null };
  t.mock.method(request, "post", async (_url, { variables }) => {
    assert.deepEqual(variables, { limit: 5, offset: 10 });
    return { data: { coretimeHistorySales: sales } };
  });
  const client = await connect(t);
  const args = { chain: "polkadot", limit: 5, offset: 10 };

  await expectToolError(client, "list_coretime_sales", args, /Output validation error[\s\S]*items/);
  sales = { total: -1, items: [] };
  await expectToolError(client, "list_coretime_sales", args, /Output validation error[\s\S]*total/);

  sales = { total: 3, items: [] };
  assert.deepEqual(await call(client, "list_coretime_sales", args), {
    ...args,
    symbol: "DOT",
    decimals: 10,
    ...sales,
  });
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
    ["bounties_list", { chain, bounty_type: "multi_asset", page: 1 }, "page"],
    ["bounties_get", { chain, bounty_type: "multi_asset", bounty_id: 0, include_statistics: false }, "include_statistics"],
    ["opengov_list_delegations", { chain, view: "delegates", track_id: 0 }, "track_id"],
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
