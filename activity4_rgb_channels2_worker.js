self.onmessage = function (e) {
  var d = e.data;

  if (d.type === "extract") {
    // RGBA flat array → R, G, B 각각 Uint8Array
    var src = new Uint8Array(d.buffer);
    var n = d.size * d.size;
    var R = new Uint8Array(n);
    var G = new Uint8Array(n);
    var B = new Uint8Array(n);
    for (var i = 0; i < n; i++) {
      R[i] = src[i * 4];
      G[i] = src[i * 4 + 1];
      B[i] = src[i * 4 + 2];
    }
    self.postMessage(
      { type: "extracted", R: R.buffer, G: G.buffer, B: B.buffer, size: d.size },
      [R.buffer, G.buffer, B.buffer]
    );
    return;
  }

  if (d.type === "rebuild") {
    // R, G, B Uint8Array → RGBA Uint8Array
    var R = new Uint8Array(d.R);
    var G = new Uint8Array(d.G);
    var B = new Uint8Array(d.B);
    var n = R.length;
    var out = new Uint8Array(n * 4);
    for (var i = 0; i < n; i++) {
      out[i * 4]     = R[i];
      out[i * 4 + 1] = G[i];
      out[i * 4 + 2] = B[i];
      out[i * 4 + 3] = 255;
    }
    self.postMessage(
      { type: "rebuilt", buffer: out.buffer, size: d.size },
      [out.buffer]
    );
  }
};
