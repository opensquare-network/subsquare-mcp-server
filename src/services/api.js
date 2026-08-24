import isNil from "lodash/isNil.js";
import omitBy from "lodash/omitBy.js";
import { EnvHttpProxyAgent, fetch } from "undici";

const API_REQUEST_TIMEOUT_MS = 10_000;
const dispatcher = new EnvHttpProxyAgent();

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
    dispatcher,
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
