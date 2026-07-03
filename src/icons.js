"use strict";
const cache = new Map(); // url -> data URI
let fetches = 0;

async function getIconDataUri(url) {
  if (!url || typeof url !== "string") return null;
  if (cache.has(url)) return cache.get(url);
  fetches += 1;
  let res;
  try {
    res = await fetch(url);
  } catch (e) {
    return null;
  }
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  const uri = "data:image/png;base64," + buf.toString("base64");
  cache.set(url, uri);
  return uri;
}

module.exports = {
  getIconDataUri,
  _stats: () => ({ fetches, size: cache.size }),
};
