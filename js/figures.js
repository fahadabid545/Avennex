/* Drawn figures.

   These stand in where a photograph or a screenshot has not been uploaded, so
   a missing image never renders as a box announcing that an image is missing.
   Everything is drawn to the same technical pen as the icon set. */
(function (global) {

  /* a storefront and a shortlist, drawn as the product would show them */
  function productMock(name) {
    var label = (name || 'Product').toUpperCase();
    return '' +
'<svg class="fig product-mock" viewBox="0 0 400 300" role="img" aria-label="Drawn interface sketch for ' + esc(name || 'this product') + '">' +
  '<rect class="ln" x="18" y="24" width="364" height="252"/>' +
  '<line class="ln" x1="18" y1="52" x2="382" y2="52"/>' +
  '<circle class="fill-mark" cx="32" cy="38" r="3"/>' +
  '<text class="lab" x="46" y="41">' + esc(label) + '</text>' +

  '<line class="ln-soft" x1="132" y1="52" x2="132" y2="276"/>' +
  '<rect class="fill-soft" x="18" y="52" width="114" height="224"/>' +
  '<line class="ln-soft" x1="34" y1="76" x2="112" y2="76"/>' +
  '<line class="ln-soft" x1="34" y1="92" x2="96" y2="92"/>' +
  '<line class="ln-soft" x1="34" y1="108" x2="104" y2="108"/>' +
  '<rect class="fill-mark" x="26" y="124" width="2" height="12"/>' +
  '<line class="ln-soft" x1="34" y1="130" x2="100" y2="130"/>' +
  '<line class="ln-soft" x1="34" y1="146" x2="88" y2="146"/>' +

  '<rect class="ln-soft" x="152" y="74" width="98" height="64"/>' +
  '<rect class="ln-soft" x="262" y="74" width="98" height="64"/>' +
  '<path class="ln" d="M160 130l22-26 16 18 12-12 22 20"/>' +
  '<circle class="ln" cx="311" cy="100" r="13"/>' +
  '<path class="ln-mark" d="M311 100 L311 88 A13 13 0 0 1 322 106 Z"/>' +

  '<line class="ln-soft" x1="152" y1="164" x2="360" y2="164"/>' +
  '<text class="num" x="152" y="182">01</text>' +
  '<line class="ln-soft" x1="176" y1="178" x2="330" y2="178"/>' +
  '<text class="num" x="152" y="204">02</text>' +
  '<line class="ln-soft" x1="176" y1="200" x2="300" y2="200"/>' +
  '<text class="num" x="152" y="226">03</text>' +
  '<line class="ln-soft" x1="176" y1="222" x2="344" y2="222"/>' +
  '<text class="num" x="152" y="248">04</text>' +
  '<line class="ln-soft" x1="176" y1="244" x2="272" y2="244"/>' +

  '<text class="lab" x="152" y="270">Interface sketch, not a screenshot</text>' +
'</svg>';
  }

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  global.AvxFig = { productMock: productMock };
})(window);
