/* global QUnit */

"use strict";

if (window.sessionStorage) {
    sessionStorage.clear();
}

QUnit.test("KRYPTOS.init()", function(assert) {
  var done = assert.async();
  KRYPTOS.init();
});