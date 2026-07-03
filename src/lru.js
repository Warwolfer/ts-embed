"use strict";
const MAX = 300;
const cache = new Map(); // key -> Buffer (insertion order = LRU order)
const inflight = new Map(); // key -> Promise<Buffer>
let producerCalls = 0;

function touch(key, val) {
  cache.delete(key);
  cache.set(key, val);
  while (cache.size > MAX) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
}

async function getOrRender(key, producer) {
  if (cache.has(key)) {
    const val = cache.get(key);
    touch(key, val); // move to most-recent
    return val;
  }
  if (inflight.has(key)) return inflight.get(key);

  const p = (async () => {
    producerCalls += 1;
    const buf = await producer();
    touch(key, buf);
    return buf;
  })();
  inflight.set(key, p);
  try {
    return await p;
  } finally {
    inflight.delete(key);
  }
}

module.exports = {
  getOrRender,
  _stats: () => ({ size: cache.size, producerCalls }),
};
