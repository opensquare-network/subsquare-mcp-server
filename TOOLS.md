# MCP Tools

The server exposes **35 read-only tools**. Each tool covers a family of related records and
selects the specific record set with an enum argument (`kind`, `view`, `bounty_type`, or
`referendum_type`) instead of exposing one tool per endpoint.

Conventions:

- All tools are read-only and paginated unless stated otherwise; pass `page` / `page_size`
  (or `limit` / `offset` where the upstream API requires it). `account_list` and `block_list`
  use a zero-based `page`; every other paginated tool starts at page 1.
- `chain` accepts only the chains listed for the tool; unsupported combinations fail fast
  with an actionable error.
- Arguments that do not apply to the selected record type are rejected with an actionable
  error instead of being silently ignored.
- JSON payloads are returned in `structuredContent` and mirrored as text in `content`.

## OpenGov

| Tool | Enum | Description | Chains |
| --- | --- | --- | --- |
| `opengov_list_referenda` | — | List and filter referenda, or list one proposer's referenda with `proposer`. The response also carries chain-wide state counts as `summary`. | Polkadot, Kusama, Hydration, Polkadot Collectives |
| `opengov_referendum_detail` | — | Get one referendum's full details. | Polkadot, Kusama, Hydration, Polkadot Collectives |
| `opengov_list_tracks` | — | List track IDs, names, active referendum counts, and detail URLs. Collectives returns Fellowship tracks. | Polkadot, Kusama, Hydration, Polkadot Collectives |
| `list_referendum_comments` | `referendum_type` = `opengov` \| `fellowship` \| `ambassador` | List referendum comments, optionally merged with Polkassembly comments, with reactions and nested replies. | OpenGov: Polkadot, Kusama, Hydration. Fellowship: Polkadot Collectives, Kusama. Ambassador: Polkadot Collectives |
| `opengov_list_delegations` | `view` = `delegates` \| `delegators` \| `track` | List delegates with statistics, one delegate's delegators (`address`), or delegation relationships for one `track_id`. | Polkadot, Kusama, Hydration |

## Democracy, Council, and Technical Committee

| Tool | Enum | Description | Chains |
| --- | --- | --- | --- |
| `democracy_list` | `kind` = `referendums` \| `proposals` \| `externals` | List legacy Democracy referendums, public proposals, or external proposals. | Polkadot, Kusama, Hydration |
| `committee_list` | `kind` = `council_motions` \| `techcomm_proposals` | List Council motions or Technical Committee proposals with compact fields and detail URLs. | Polkadot, Kusama, Hydration |
| `techcomm_list_members` | — | Query current Technical Committee member addresses from chain storage (unpaginated). | Hydration |

## Treasury and Bounties

| Tool | Enum | Description | Chains |
| --- | --- | --- | --- |
| `treasury_list` | `kind` = `projects` \| `tips` \| `proposals` \| `spends` | List Treasury projects, tips, proposals, or spends with state, amounts, identities, and detail URLs. | Projects: Polkadot. Tips, proposals, spends: Polkadot, Kusama, Hydration |
| `treasury_get` | `view` = `status` \| `burn` | Summarize Treasury activity counts, or get cumulative burns with paginated records and optional history. | Polkadot, Kusama, Hydration |
| `treasury_get_balances` | — | Get Treasury balances reported by DotTreasury for one chain or every reported chain. | Polkadot, Kusama, Hydration, Acala, Karura, Bifrost, Astar |
| `treasury_get_project_detail` | — | Get one Polkadot Treasury project with its linked proposals, spends, tips, bounties, and child bounties. | Polkadot |
| `bounties_list` | `bounty_type` = `native` \| `multi_asset` \| `multi_asset_child` | List native bounties, Multi-Asset Bounties (`status` = `active`, the default when omitted, or `inactive`), or child bounties of a Multi-Asset Bounty (`child_status`). | Polkadot, Kusama |
| `bounties_get` | `bounty_type` = `native` \| `multi_asset` \| `multi_asset_child` | Get one native bounty (optional `include_statistics`; `statistics` is null when the API has none), one Multi-Asset Bounty, or one child bounty. | Polkadot, Kusama |

## Polkadot Fellowship

| Tool | Enum | Description |
| --- | --- | --- |
| `fellowship_list` | `kind` = `feeds` \| `applications` \| `members` | Browse the activity feed, membership applications, or the current member roster. |
| `fellowship_get_member_detail` | — | Get a member profile with evidence, salary claims, submitted referenda, votes, and salary/rank statistics. |
| `fellowship_list_address_activity` | `kind` = `referenda` \| `votes` | List Fellowship referenda submitted by an address, or its votes (`type` = `aye` \| `nay`). |
| `fellowship_salary` | `kind` = `overview` \| `by_rank` \| `rank_changes` \| `member` \| `claimants` | Salary spending by cycle or by rank, rank-change counts, one address's salary statistics (`address`), or all claimants. |
| `fellowship_treasury_get` | `view` = `balance` \| `status` | Get Treasury DOT/HOLLAR and salary USDT/HOLLAR balances, or active and total spend counts. |
| `fellowship_treasury_list_spends` | — | List Fellowship Treasury spends with amounts, state, and detail URLs. |
| `fellowship_treasury_get_spend` | — | Get one spend's beneficiary, related referendum, and markdown content. |

## Polkadot Secretary

| Tool | Enum | Description | Chains |
| --- | --- | --- | --- |
| `secretary_list` | `kind` = `members` \| `cycles` \| `statistics` | List current members with rank and configured salary, list salary cycles, or summarize salary and interim funding by asset and address. | Polkadot Collectives |

## Posts, Accounts, Blocks, and Identities

| Tool | Enum | Description | Chains |
| --- | --- | --- | --- |
| `posts_list_posts` | — | List discussion posts with exact label filtering and a simple mode omitting body and poll fields. | Polkadot, Kusama, Polkadot Collectives, Hydration |
| `posts_get_post` | — | Get one discussion post with its full markdown content. | Polkadot, Kusama, Polkadot Collectives, Hydration |
| `account_list` | `kind` = `extrinsics` \| `transfers` \| `assets` \| `foreign_assets` | List account extrinsics, transfers, pallet-assets tokens, or pallet-foreign-assets (XCM) tokens. `assets` and `foreign_assets` require an Asset Hub chain. | StateScan chains; assets need Polkadot or Kusama Asset Hub |
| `block_get_detail` | — | Get a block by height or hash, or the latest block. | StateScan chains |
| `block_list` | `kind` = `events` \| `extrinsics` | List events or extrinsics with section, method, block, and date filters. | StateScan chains |
| `identity_get_identities` | — | Batch-query display names and identity verification status for addresses. | Polkadot, Kusama, Hydration, Polkadot Collectives, Polkadot Asset Hub, Kusama Asset Hub |

## User Records

| Tool | Enum | Description | Chains |
| --- | --- | --- | --- |
| `get_user_overview` | — | Get a user profile, submission counts, and selected module vote statistics. | Polkadot, Kusama |
| `list_user_submissions` | — | List a user's submissions for one mapped category. | Polkadot, Kusama |
| `list_user_voting` | `kind` = `votes` \| `vote_calls` | List a user's votes (optionally filtered by vote type) or vote calls in one voting module. | Polkadot, Kusama |

## Vesting and Coretime

| Tool | Description | Chains |
| --- | --- | --- |
| `get_account_vesting` | Get an account's Vesting lock, unlockable amount, and schedules with release end heights. | Polkadot Asset Hub, Kusama Asset Hub |
| `list_vesting_accounts` | List accounts with Vesting schedules, ranked globally by unlockable amount by default. | Polkadot Asset Hub, Kusama Asset Hub |
| `list_coretime_sales` | List Coretime sale cycles with compact records. | Polkadot, Kusama |
| `get_coretime_sale` | Get a Coretime sale overview with optional purchases, renewals, and timeline. | Polkadot, Kusama |
