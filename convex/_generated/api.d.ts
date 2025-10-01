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
import type * as crons from "../crons.js";
import type * as http from "../http.js";
import type * as idempotency from "../idempotency.js";
import type * as lib_ai from "../lib/ai.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_encryption from "../lib/encryption.js";
import type * as lib_enrollmentIdempotency from "../lib/enrollmentIdempotency.js";
import type * as lib_env from "../lib/env.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_httpAuth from "../lib/httpAuth.js";
import type * as lib_idempotency from "../lib/idempotency.js";
import type * as lib_messageIdempotency from "../lib/messageIdempotency.js";
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
  crons: typeof crons;
  http: typeof http;
  idempotency: typeof idempotency;
  "lib/ai": typeof lib_ai;
  "lib/auth": typeof lib_auth;
  "lib/encryption": typeof lib_encryption;
  "lib/enrollmentIdempotency": typeof lib_enrollmentIdempotency;
  "lib/env": typeof lib_env;
  "lib/errors": typeof lib_errors;
  "lib/httpAuth": typeof lib_httpAuth;
  "lib/idempotency": typeof lib_idempotency;
  "lib/messageIdempotency": typeof lib_messageIdempotency;
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
