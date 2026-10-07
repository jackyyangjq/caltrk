export function mergeMissing(cur, add, keyFn) {
  var seen = {}, n = 0;
  cur.forEach(function (x) { seen[keyFn(x)] = 1; });
  (Array.isArray(add) ? add : []).forEach(function (x) {
    if (!x || typeof x !== "object") return;
    var k = keyFn(x);
    if (k == null || seen[k]) return;
    seen[k] = 1; cur.push(x); n++;
  });
  return n;
}
