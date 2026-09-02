import pick from "lodash/pick.js";
import pLimit from "p-limit";
import { chains } from "../../../config/chain.js";
import { getChainConfig } from "../../../config/chains.js";
import { getTreasuryProjectItemDetail } from "../api.js";
import { calculateTreasuryItemFiat } from "./amounts.js";

const PROJECT_FIELDS = [
  "id",
  "name",
  "nameAbbr",
  "description",
  "links",
  "category",
  "fiatAtSubmission",
  "fiatAtFinal",
  "proposalsCount",
];
const PROJECT_ITEM_RELATION_FIELDS = [
  "id",
  "hash",
  "parentBountyId",
  "index",
  "blockHeight",
  "proportion",
];
const PROJECT_ITEM_DETAIL_FIELDS = [
  "proposalIndex",
  "referendumIndex",
  "bountyIndex",
  "parentBountyId",
  "index",
  "hash",
  "title",
  "contentSummary.summary",
  "state",
  "proposer",
  "finder",
  "beneficiary",
  "track",
  "createdAt",
  "lastActivityAt",
  "dValue",
  "onchainData.isFinal",
];
const PROJECT_DETAIL_REQUEST_CONCURRENCY = 6;
const limitProjectDetailRequests = pLimit(PROJECT_DETAIL_REQUEST_CONCURRENCY);

const projectItemTypes = Object.freeze(
  [
    {
      type: "proposal",
      projectField: "proposals",
      idField: "id",
      detailPath: "treasury/proposals",
      detailFields: ["onchainData.value"],
    },
    {
      type: "spend",
      projectField: "spends",
      idField: "id",
      detailPath: "treasury/spends",
      detailFields: [
        "onchainData.extracted.amount",
        "onchainData.extracted.assetKind",
        "onchainData.extracted.beneficiary",
      ],
    },
    {
      type: "childBounty",
      projectField: "childBounties",
      idField: "id",
      detailPath: "treasury/child-bounties",
      detailFields: [
        "onchainData.value",
        "onchainData.fee",
        "onchainData.curator",
      ],
    },
    {
      type: "tip",
      projectField: "tips",
      idField: "hash",
      detailPath: "treasury/tips",
      detailFields: ["onchainData.medianValue", "onchainData.tipFindersFee"],
    },
    {
      type: "bounty",
      projectField: "bounties",
      idField: "id",
      detailPath: "treasury/bounties",
      detailFields: ["onchainData.value", "onchainData.extractedCurators"],
    },
    {
      type: "multiAssetBounty",
      projectField: "multiAssetBounties",
      idField: "id",
      detailPath: "treasury/multi-asset-bounties",
      detailFields: [
        "onchainData.value",
        "onchainData.assetKind",
        "onchainData.curator",
      ],
    },
  ].map((itemType) => Object.freeze(itemType)),
);

export function summarizeTreasuryProject(project) {
  return pick(project, PROJECT_FIELDS);
}

function getProjectItemId(itemType, relation) {
  const id = String(relation[itemType.idField] ?? "").trim();
  if (id) {
    return id;
  }

  if (
    itemType.type === "childBounty" &&
    relation.parentBountyId != null &&
    relation.index != null
  ) {
    return [relation.parentBountyId, relation.index, relation.blockHeight]
      .filter((value) => value != null)
      .join("_");
  }

  throw new Error(
    "Treasury " + itemType.type + " relation is missing " + itemType.idField,
  );
}

function createProjectItemUrl(itemType, id) {
  return new URL(
    itemType.detailPath + "/" + encodeURIComponent(id),
    getChainConfig(chains.polkadot).siteUrl,
  ).toString();
}

function createProjectItem(itemType, relation, detail, id) {
  return {
    ...pick(relation, PROJECT_ITEM_RELATION_FIELDS),
    url: createProjectItemUrl(itemType, id),
    detail: pick(detail, [
      ...PROJECT_ITEM_DETAIL_FIELDS,
      ...itemType.detailFields,
    ]),
    ...calculateTreasuryItemFiat({
      type: itemType.type,
      detail,
      proportion: relation.proportion,
    }),
  };
}

export async function fetchProjectDetails(project) {
  const entries = await Promise.all(
    projectItemTypes.map(async (itemType) => {
      const relations = Array.isArray(project[itemType.projectField])
        ? project[itemType.projectField]
        : [];
      const items = await Promise.all(
        relations.map(async (relation) => {
          const id = getProjectItemId(itemType, relation);
          const detail = await limitProjectDetailRequests(
            getTreasuryProjectItemDetail,
            itemType.detailPath,
            id,
          );

          return createProjectItem(itemType, relation, detail, id);
        }),
      );

      return [itemType.projectField, items];
    }),
  );

  return {
    ...summarizeTreasuryProject(project),
    ...Object.fromEntries(entries),
  };
}
