# Subsquare MCP Server

## Dev

```
pnpm start
```

Debug with the MCP inspector

```
npx --yes @modelcontextprotocol/inspector@latest
```

## Install

```bash
claude mcp add --scope user --transport http subsquare-mcp http://127.0.0.1:3210/mcp
```

## Reinstall

```bash
claude mcp remove subsquare-mcp

claude mcp add --scope user --transport http subsquare-mcp http://127.0.0.1:3210/mcp
```

Available `--scope` values:

- `local`: Local configuration (default)
- `user`: Global configuration for the current user
- `project`: Project configuration

# Streamable HTTP

```
http://127.0.0.1:3210/mcp
```

## MCP Tools

The server exposes **48 read-only tools** through the `/mcp` endpoint.

### Coretime

| Tool | Description | Chains |
| --- | --- | --- |
| `list_coretime_sales` | Locate sale IDs with compact cycle records; `limit` defaults to 10, `offset` to 0. | Polkadot, Kusama |
| `get_coretime_sale` | Get a cycle overview; omit `saleId` for the current cycle. | Polkadot, Kusama |

Both tools require `chain`. Detail flags `includePurchases`, `includeRenewals`, and `includeTimeline` default to false. Purchase and renewal pages use independent `purchasesLimit`/`purchasesOffset` and `renewalsLimit`/`renewalsOffset` (defaults 20/0, maximum limit 100). Timeline events include `args` and are not paginated.

Amounts remain raw strings with top-level `symbol` and `decimals`. `regionBegin`/`regionEnd` are timeslices, not Unix times; indexer `blockTime` values are event timestamps in milliseconds. Detail `infoUpdatedAt` preserves the sale info update chain, block height, and time.

Example: `get_coretime_sale({"chain":"polkadot","saleId":20,"includePurchases":true})`.

### OpenGov

| Tool | Description | Chains |
| --- | --- | --- |
| `opengov_list_referenda` | List and filter referenda. | Polkadot, Kusama, Hydration, Polkadot Collectives |
| `opengov_referendum_detail` | Get a referendum's full details. | Polkadot, Kusama, Hydration, Polkadot Collectives |
| `opengov_referenda_summary` | Get referendum statistics. | Polkadot, Kusama, Hydration, Polkadot Collectives |
| `opengov_list_referenda_by_address` | List referenda submitted by an address. | Polkadot, Kusama, Hydration |
| `opengov_list_votes_by_address` | List referendum votes cast by an address. | Polkadot, Kusama, Hydration |
| `list_delegates` | List delegates with delegation statistics and available profiles. | Polkadot, Kusama, Hydration |
| `get_delegate_delegators` | Get delegation relationships received by a delegate, paginated with caching and an optional track filter. | Polkadot, Kusama, Hydration |
| `list_delegations` | List delegation relationships for one required OpenGov track. | Polkadot, Kusama, Hydration |

On Polkadot Collectives, the first three tools use Fellowship referenda. Asset Hub SubSquare REST endpoints are not currently configured.

`list_delegations(chain, track_id, page, page_size)` requires a nonnegative integer `track_id` (including track 0). Pagination starts at page 1, defaults to 25 items, and allows up to 100 items per page. It returns `items`, `page`, `pageSize`, and `total`; each item contains `delegator`, `delegatee`, `track_id`, `balance`, `conviction`, and `votes`. Balance and votes retain the API's base-unit strings without numeric conversion.

`list_delegates(chain, page, page_size)` uses the same pagination defaults and returns the API's delegate records, including addresses, delegation statistics, and available profiles. `get_delegate_delegators(chain, address, track_id?, page, page_size)` paginates the full upstream list server-side (the upstream endpoint ignores pagination and track filtering): the full result is fetched once and cached for 5 minutes per chain and address, then sliced locally. It defaults to 100 items per page (max 200) and, alongside the paginated `items`, returns `identities` (addresses mapped to display/status), `summary` (delegation count, unique delegator count, track count, and total balance/votes in base units), and the same relationship fields as `list_delegations`. `list_delegations` responses also include an `identities` map.

### Democracy, Council, and Technical Committee

| Tool | Description | Chains |
| --- | --- | --- |
| `democracy_list_referendums` | List legacy Democracy referendums. | Polkadot, Kusama, Hydration |
| `democracy_list_proposals` | List Democracy public proposals. | Polkadot, Kusama, Hydration |
| `democracy_list_externals` | List Democracy external proposals. | Polkadot, Kusama, Hydration |
| `council_list_motions` | List Council motions with compact fields and detail URLs. | Polkadot, Kusama, Hydration |
| `techcomm_list_proposals` | List Technical Committee proposals with compact fields and detail URLs. | Polkadot, Kusama, Hydration |
| `techcomm_list_members` | Query current Technical Committee member addresses from chain storage. | Hydration |

Council and Technical Committee proposals on Polkadot and Kusama are historical archives.

### Treasury and Bounties

| Tool | Description | Chains |
| --- | --- | --- |
| `treasury_list_projects` | List all Treasury projects with compact metadata. | Polkadot |
| `treasury_get_project_detail` | Get a project and its linked proposals, spends, tips, and bounties. | Polkadot |
| `treasury_list_tips` | List tips with identities, state, median value, and detail URLs. | Polkadot, Kusama, Hydration |
| `treasury_list_proposals` | List Treasury proposals with active and total counts. | Polkadot, Kusama, Hydration |
| `treasury_list_spends` | List Treasury spends with active and total counts. | Polkadot, Kusama, Hydration |
| `treasury_get_status` | Summarize Treasury activity counts. | Polkadot, Kusama, Hydration |
| `get_treasury_burn` | Get cumulative burns, paginated records, and optional history (newest first). Requires `chain`; `page` defaults to 1, `pageSize` to 25 (maximum 100), and `includeHistory` to false. | Polkadot, Kusama, Hydration |
| `treasury_get_balances` | Get Treasury balances for one or all supported chains. | Polkadot, Kusama, Hydration, Acala, Karura, Bifrost, Astar |
| `bounties_list_bounties` | List bounties with active and total counts. | Polkadot, Kusama |
| `bounties_get_bounty` | Get a bounty's proposer, curator, value, and content. | Polkadot, Kusama |

### Polkadot Fellowship

These tools query Polkadot Fellowship. Treasury and salary balances are held on Polkadot Asset Hub.

| Tool | Description |
| --- | --- |
| `fellowship_list_feeds` | Browse the chronological Fellowship activity feed. |
| `fellowship_list_members` | List current members and rank-0 candidates. |
| `fellowship_get_member_detail` | Get a member profile, evidence, salary, referendum and voting histories, and statistics. |
| `fellowship_list_referenda_by_address` | List Fellowship referenda submitted by an address. |
| `fellowship_list_votes_by_address` | List Fellowship votes cast by an address. |
| `fellowship_treasury_get_balance` | Get Treasury DOT/HOLLAR and salary USDT/HOLLAR balances. |
| `fellowship_treasury_get_status` | Get active and total Treasury spend counts. |
| `fellowship_treasury_list_spends` | List Treasury spends with amounts, state, and detail URLs. |
| `fellowship_treasury_get_spend` | Get a spend's beneficiary, related referendum, and content. |
| `get_fellowship_salary_overview` | Get salary spending by cycle and aggregated totals. |
| `get_fellowship_salary_by_rank` | Get salary spending and its percentage breakdown by rank. |
| `get_fellowship_rank_change_statistics` | Get promotion, demotion, and retention counts. |
| `get_fellowship_member_statistics` | Get an address's salary totals, participating cycles, and rank history. |
| `list_fellowship_salary_claimants` | List all salary claimants with claimed cycles and totals. |

### Polkadot Secretary

These tools query Polkadot Secretary on Polkadot Collectives.

| Tool | Description | Chains |
| --- | --- | --- |
| `secretary_list_members` | List current members, ranks, configured salaries, and identities. | Polkadot Collectives |
| `secretary_salary_cycles` | List salary cycles with payment counts, amounts, and block times. | Polkadot Collectives |
| `secretary_salary_statistics` | Summarize salary and interim funding by asset and address, including the USD total. | Polkadot Collectives |

### Accounts, Blocks, and Identities

| Tool | Description | Chains |
| --- | --- | --- |
| `account_list_extrinsics` | List compact account extrinsics with detail URLs and identity mappings. | Polkadot, Kusama, Polkadot Collectives, Polkadot Asset Hub, Kusama Asset Hub |
| `account_list_transfers` | List account transfers with detail URLs and identity mappings. | Polkadot, Kusama, Polkadot Collectives, Polkadot Asset Hub, Kusama Asset Hub |
| `block_get_detail` | Get a block by height or hash, or get the latest block. | Polkadot, Kusama, Polkadot Collectives, Polkadot Asset Hub, Kusama Asset Hub |
| `block_list_events` | List events with module, method, block, and date filters. | Polkadot, Kusama, Polkadot Collectives, Polkadot Asset Hub, Kusama Asset Hub |
| `block_list_extrinsics` | List extrinsics with module, method, block, and date filters. | Polkadot, Kusama, Polkadot Collectives, Polkadot Asset Hub, Kusama Asset Hub |
| `identity_get_identities` | Batch-query address display names and identity verification status. | Polkadot, Kusama, Hydration, Polkadot Collectives, Polkadot Asset Hub, Kusama Asset Hub |
