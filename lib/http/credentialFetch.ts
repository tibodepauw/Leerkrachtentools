/** Never forward provider credentials or request content through redirects. */
export const credentialFetch: typeof fetch = (input, init) =>
  fetch(input, { ...init, redirect: "error" });
