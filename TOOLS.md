# MCP Tools

The server exposes **46 read-only tools**. Related records are often grouped in one tool
and selected with an enum argument (`kind`, `view`, `mode`, `bounty_type`, or `referendum_type`).
Dedicated statistics tools do not load the related lists, profiles, or details.

Conventions:

- All tools are read-only. Most paginated lists take `page` / `page_size` starting at page 1.
  `block_list` and account extrinsics/transfers start at page 0. Account assets and Coretime
  list queries take `limit` / `offset`; Vesting accounts take `limit` / `cursor`.
- Paginated Treasury, bounty, track delegatee, Fellowship feed/application, and StateScan
  queries return an error for incomplete upstream pages. A valid page can be empty, and
  StateScan block lists do not require a `total`.
- `chain` accepts only the chains listed for the tool; unsupported combinations fail fast
  with an actionable error.
- Arguments that do not apply to the selected record type are rejected with an actionable
  error instead of being silently ignored.
- JSON payloads are returned in `structuredContent` and mirrored as text in `content`.

## Discovery and Overview

| Tool | Enum | Description | Chains |
| --- | --- | --- | --- |
| `gov_search` | `mode` = `keyword` \| `full_text` | Match keywords across governance modules (default), or search posts and comments with highlighted snippets. Projects and Wiki articles appear where available. | Keyword: Polkadot, Kusama, Hydration, Polkadot Collectives. Full text: Polkadot |
| `gov_overview` | — | Get active and total counts by module and by track (Fellowship tracks on Collectives). Set `recent: true` for active or recently updated records. | Polkadot, Kusama, Hydration, Polkadot Collectives |
| `list_gov_events` | — | List governance events between inclusive `begin_time` and `end_time` bounds, with category, sub-category, and type filters. Set `summary: false` to include details. | Polkadot, Kusama, Hydration, Polkadot Collectives |

## OpenGov and Referenda

| Tool | Enum | Description | Chains |
| --- | --- | --- | --- |
| `opengov_list_referenda` | — | List and filter referenda, or use `proposer` to list one user's referenda (not on Collectives). Set `include_summary: true` for chain-wide state counts, cached for one minute. `summaryStatus` is `available`, `not_requested`, or `unavailable`. | Polkadot, Kusama, Hydration, Polkadot Collectives |
| `opengov_referenda_summary` | — | Get chain-wide state counts without fetching a referendum list. Shares the one-minute cache with `opengov_list_referenda`. On Collectives, returns Fellowship counts. | Polkadot, Kusama, Hydration, Polkadot Collectives |
| `opengov_referendum_detail` | — | Get one referendum's full details. Set `resolve_preimage: true` to also look up the decoded proposal preimage. | Polkadot, Kusama, Hydration, Polkadot Collectives |
| `get_preimage` | — | Look up a decoded preimage by its 0x-prefixed hash, including nested batched calls. `found` is false when no preimage is stored. | Polkadot, Kusama, Hydration, Polkadot Collectives |
| `opengov_list_tracks` | — | List track IDs, names, active referendum counts, and detail URLs. Collectives returns Fellowship tracks. | Polkadot, Kusama, Hydration, Polkadot Collectives |
| `opengov_list_track_statistics` | — | Compare OpenGov tracks by turnout ratios, referendum counts, and delegation statistics. | Polkadot, Kusama, Hydration |
| `opengov_get_track_turnout` | — | Get one track's per-referendum turnout series with turnout and approval percentages. | Polkadot, Kusama, Hydration |
| `list_referendum_votes` | `referendum_type` = `opengov` \| `fellowship` | List votes with a referendum-wide summary and OpenGov turnout statistics when available. Set `include_tally_history: true` to include the tally series; `tally_limit` only applies in that case. | OpenGov: Polkadot, Kusama, Hydration. Fellowship: Kusama, Polkadot Collectives |
| `list_referendum_comments` | `referendum_type` = `opengov` \| `fellowship` \| `ambassador` | List referendum comments, optionally merged with Polkassembly comments, with reactions and nested replies. | OpenGov: Polkadot, Kusama, Hydration. Fellowship: Polkadot Collectives, Kusama. Ambassador: Polkadot Collectives |
| `opengov_list_delegations` | `view` = `delegates` \| `delegators` \| `track` \| `track_delegatees` | List delegates with statistics, one delegate's delegators (`address`), delegation relationships for one `track_id`, or ranked delegatees for one `track_id`. `sort_by` and `sort_order` apply only to `track_delegatees`. `page_size` defaults to 100 for `delegators`, 25 otherwise. | Polkadot, Kusama, Hydration |

## Democracy, Council, and Technical Committee

| Tool | Enum | Description | Chains |
| --- | --- | --- | --- |
| `democracy_list` | `kind` = `referendums` \| `proposals` \| `externals` | List legacy Democracy referendums, public proposals, or external proposals. | Polkadot, Kusama, Hydration |
| `committee_list` | `kind` = `council_motions` \| `techcomm_proposals` | List Council motions or Technical Committee proposals with compact fields and detail URLs. | Polkadot, Kusama, Hydration |
| `techcomm_list_members` | — | Query current Technical Committee member addresses from chain storage (unpaginated). | Hydration |

## Treasury and Bounties

| Tool | Enum | Description | Chains |
| --- | --- | --- | --- |
| `treasury_list` | `kind` = `projects` \| `tips` \| `proposals` \| `spends` \| `beneficiaries` | Return all projects or paginated tips, proposals, spends, or beneficiaries. Use `sort_by` to rank beneficiaries by estimated USD value. Use `treasury_get_project_detail` for a project's linked funding records. | Projects: Polkadot. Beneficiaries: Polkadot, Kusama. Tips, proposals, spends: Polkadot, Kusama, Hydration |
| `get_address_treasury_benefits` | — | Get one address's benefit counts and USD values, with paginated beneficiary records for all or selected Treasury modules. | Polkadot, Kusama |
| `treasury_get` | `view` = `status` \| `burn` | Summarize Treasury activity counts, or get cumulative burns with paginated records and optional history. Pagination and `include_history` apply only to `view=burn`. | Polkadot, Kusama, Hydration |
| `treasury_get_balances` | — | Get Treasury balances reported by DotTreasury for one chain or every reported chain. | Polkadot, Kusama, Hydration, Acala, Karura, Bifrost, Astar |
| `treasury_get_project_detail` | — | Get one Polkadot Treasury project with its linked proposals, spends, tips, bounties, and child bounties. | Polkadot |
| `bounties_list` | `bounty_type` = `native` \| `multi_asset` \| `multi_asset_child` | List native bounties, Multi-Asset Bounties (`status=active` by default, unpaginated; `status=inactive` is paginated), or child bounties of a Multi-Asset Bounty (`child_status`). | Polkadot, Kusama |
| `bounties_get` | `bounty_type` = `native` \| `multi_asset` \| `multi_asset_child` | Get one native bounty (optional `include_statistics`; `statistics` is null when the API has none), one Multi-Asset Bounty, or one child bounty. | Polkadot, Kusama |
| `bounties_get_bounty_statistics` | — | Get native bounty payout statistics by `bounty_index` without fetching bounty details or its chain balance. Defaults to Polkadot. | Polkadot, Kusama |

## Polkadot Fellowship

| Tool | Enum | Description |
| --- | --- | --- |
| `fellowship_list` | `kind` = `feeds` \| `applications` \| `members` | Browse the activity feed or membership applications with pagination, or get the full member roster without pagination. |
| `fellowship_get_member_detail` | — | Get a member profile with evidence, salary claims, submitted referenda, votes, and salary/rank statistics. |
| `fellowship_list_address_activity` | `kind` = `referenda` \| `votes` | List Fellowship referenda submitted by an address, or its votes (`type` = `aye` \| `nay`). |
| `fellowship_salary` | `kind` = `overview` \| `by_rank` \| `rank_changes` \| `member` \| `claimants` | Salary spending by cycle or by rank, rank-change counts, one address's salary statistics (`address`), or all claimants. |
| `fellowship_treasury_get` | `view` = `balance` \| `status` | Get Treasury DOT/HOLLAR and salary USDT/HOLLAR balances, or active and total spend counts. Does not accept pagination. |
| `fellowship_treasury_list_spends` | — | List Fellowship Treasury spends with amounts, state, and detail URLs. |
| `fellowship_treasury_get_spend` | — | Get one spend's beneficiary, related referendum, and markdown content. |

## Polkadot Secretary

| Tool | Enum | Description | Chains |
| --- | --- | --- | --- |
| `secretary_list` | `kind` = `members` \| `cycles` \| `statistics` | List current members with rank and configured salary, list salary cycles, or summarize salary and interim funding by asset and address. Does not accept pagination. | Polkadot Collectives |

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
| `get_user_vote_stats` | — | Get vote statistics for selected `modules` without fetching the user's profile or submission counts. | Polkadot, Kusama |
| `list_user_submissions` | — | List a user's submissions for one mapped category. | Polkadot, Kusama |
| `list_user_voting` | `kind` = `votes` \| `vote_calls` | List a user's votes or vote calls in one voting module. `type` and `includes_title` apply only to `kind=votes`. Titles and states are included by default; set `includes_title: false` to omit them. | Polkadot, Kusama; Hydration only for `kind=votes, module=referenda` |

## Vesting and Coretime

| Tool | Description | Chains |
| --- | --- | --- |
| `get_account_vesting` | Get an account's Vesting lock, unlockable amount, and schedules with release end heights. | Polkadot Asset Hub, Kusama Asset Hub |
| `list_vesting_accounts` | List accounts with Vesting schedules, ranked globally by unlockable amount by default. | Polkadot Asset Hub, Kusama Asset Hub |
| `list_coretime_sales` | List Coretime sale cycles with compact records. | Polkadot, Kusama |
| `get_coretime_sale` | Get a Coretime sale overview with optional purchases, renewals, and timeline. | Polkadot, Kusama |

## Migrating added tools

| Previous tool | Replacement |
| --- | --- |
| `gov_search_full_text` | `gov_search` with `mode=full_text` |
| `opengov_list_referendum_votes` | `list_referendum_votes` with `referendum_type=opengov` |
| `fellowship_list_referendum_votes` | `list_referendum_votes` with `referendum_type=fellowship` |
| `opengov_list_track_delegatees` | `opengov_list_delegations` with `view=track_delegatees` |
| `treasury_list_beneficiaries` | `treasury_list` with `kind=beneficiaries` |
