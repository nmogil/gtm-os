/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as actions from "../actions.js";
import type * as http from "../http.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_encryption from "../lib/encryption.js";
import type * as lib_env from "../lib/env.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_httpAuth from "../lib/httpAuth.js";
import type * as lib_resend from "../lib/resend.js";
import type * as lib_templateTests from "../lib/templateTests.js";
import type * as lib_templates from "../lib/templates.js";
import type * as mutations from "../mutations.js";
import type * as queries from "../queries.js";
import type * as seed from "../seed.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  actions: typeof actions;
  http: typeof http;
  "lib/auth": typeof lib_auth;
  "lib/encryption": typeof lib_encryption;
  "lib/env": typeof lib_env;
  "lib/errors": typeof lib_errors;
  "lib/httpAuth": typeof lib_httpAuth;
  "lib/resend": typeof lib_resend;
  "lib/templateTests": typeof lib_templateTests;
  "lib/templates": typeof lib_templates;
  mutations: typeof mutations;
  queries: typeof queries;
  seed: typeof seed;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
