import isNil from "lodash/isNil.js";
import omitBy from "lodash/omitBy.js";
import { EnvHttpProxyAgent, fetch } from "undici";

const API_REQUEST_TIMEOUT_MS = 10_000;
const dispatcher = new EnvHttpProxyAgent();

export class ApiRequestError extends Error {
  constructor(message, { status = null, path = null, cause } = {}) {
    super(message, { cause });
    this.name = "ApiRequestError";
    this.status = status;
    this.path = path;
  }
}

function addQueryParams(url, query) {
  const requestUrl = new URL(url);

  for (const [name, value] of Object.entries(omitBy(query, isNil))) {
    requestUrl.searchParams.set(name, value);
  }

  return requestUrl;
}

async function requestJson(url, { method = "GET", query = {}, body } = {}) {
  const requestUrl = addQueryParams(url, query);
  const hasBody = body !== undefined;
  const headers = {
    accept: "application/json",
  };
  const requestOptions = {
    method,
    headers,
    signal: AbortSignal.timeout(API_REQUEST_TIMEOUT_MS),
    dispatcher,
  };

  if (hasBody) {
    headers["content-type"] = "application/json";
    requestOptions.body = JSON.stringify(body);
  }

  let response;
  let text;
  try {
    response = await fetch(requestUrl, requestOptions);
    text = await response.text();
  } catch (error) {
    throw new ApiRequestError(
      `API request transport failed: ${error.cause?.message ?? error.message}`,
      { path: requestUrl.pathname, cause: error },
    );
  }

  if (response.ok) {
    return JSON.parse(text);
  }

  const message = text.trim() || response.statusText || "Unknown error";
  throw new ApiRequestError(
    `API request failed with status ${response.status}: ${message}`,
    {
      status: response.status,
      path: requestUrl.pathname,
    },
  );
}

export const request = {
  get(url, query = {}) {
    return requestJson(url, { query });
  },
  post(url, body) {
    return requestJson(url, { method: "POST", body });
  },
};
