import isNil from "lodash/isNil.js";
import omitBy from "lodash/omitBy.js";

const API_REQUEST_TIMEOUT_MS = 10_000;

function addQueryParams(url, query) {
  const requestUrl = new URL(url);
  requestUrl.search = new URLSearchParams(omitBy(query, isNil)).toString();

  return requestUrl;
}

export async function fetchJson(url, query = {}) {
  const response = await fetch(addQueryParams(url, query), {
    method: "GET",
    headers: {
      accept: "application/json",
    },
    signal: AbortSignal.timeout(API_REQUEST_TIMEOUT_MS),
  });

  if (response.ok) {
    return response.json();
  }

  const message =
    (await response.text()).trim() || response.statusText || "Unknown error";
  throw new Error(
    `SubSquare API request failed with status ${response.status}: ${message}`,
  );
}
