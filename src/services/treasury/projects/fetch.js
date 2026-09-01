import { getTreasuryProjectItemDetail } from "../api.js";
import { calculateTreasuryItemFiat } from "./amounts.js";

const projectItemTypes = Object.freeze([
  {
    type: "proposal",
    projectField: "proposals",
    idField: "id",
    detailPath: "treasury/proposals",
  },
  {
    type: "spend",
    projectField: "spends",
    idField: "id",
    detailPath: "treasury/spends",
  },
  {
    type: "childBounty",
    projectField: "childBounties",
    idField: "id",
    detailPath: "treasury/child-bounties",
  },
  {
    type: "tip",
    projectField: "tips",
    idField: "hash",
    detailPath: "treasury/tips",
  },
  {
    type: "bounty",
    projectField: "bounties",
    idField: "id",
    detailPath: "treasury/bounties",
  },
  {
    type: "multiAssetBounty",
    projectField: "multiAssetBounties",
    idField: "id",
    detailPath: "treasury/multi-asset-bounties",
  },
].map((itemType) => Object.freeze(itemType)));

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

export async function fetchProjectDetails(project) {
  const entries = await Promise.all(
    projectItemTypes.map(async (itemType) => {
      const relations = Array.isArray(project[itemType.projectField])
        ? project[itemType.projectField]
        : [];
      const items = await Promise.all(
        relations.map(async (relation) => {
          const id = getProjectItemId(itemType, relation);
          const detail = await getTreasuryProjectItemDetail(
            itemType.detailPath,
            id,
          );

          return {
            ...relation,
            detail,
            ...calculateTreasuryItemFiat({
              type: itemType.type,
              detail,
              proportion: relation.proportion,
            }),
          };
        }),
      );

      return [itemType.projectField, items];
    }),
  );

  return {
    ...project,
    ...Object.fromEntries(entries),
  };
}
