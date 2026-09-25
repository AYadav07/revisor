/**
 * Reads a `:id` route param as an entity id. Only plain positive integers count: "abc", "0", "-3",
 * "1.5" and "007" are all "no such thing" without ever asking the server.
 */
export function parseIdParam(param: string | undefined): number | null {
  if (param === undefined || !/^[1-9]\d*$/.test(param)) return null
  const id = Number(param)
  return Number.isSafeInteger(id) ? id : null
}
