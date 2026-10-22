/* GOLD1 — gold melt-value calculator.
 *
 * Arithmetic only: fine gold = weight × (karat / 24);
 * melt value = fine gold / 31.1034768 × spot.
 * Every result is stamped with the inputs that produced it so a reader can
 * never mistake an estimate for a quoted price.
 */
(function () {
  "use strict";

  var GRAMS_PER_TROY_OUNCE = 31.1034768;
  var RECORDED_SPOT = parseFloat(document.getElementById("spot").value) || 0;

  var weightInput = document.getElementById("weight");
  var karatSelect = document.getElementById("karat");
  var customPurity = document.getElementById("custom-purity");
  var spotInput = document.getElementById("spot");
  var paidInput = document.getElementById("paid");
  var resetButton = document.getElementById("calc-reset");

  var outFine = document.getElementById("out-fine");
  var outFineSub = document.getElementById("out-fine-sub");
  var outValue = document.getElementById("out-value");
  var outValueSub = document.getElementById("out-value-sub");
  var outShare = document.getElementById("out-share");
  var outShareSub = document.getElementById("out-share-sub");

  function number(value) {
    var parsed = parseFloat(value);
    return isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  function money(value) {
    return "$" + value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function grams(value) {
    return value.toLocaleString("en-US", {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3
    }) + " g";
  }

  function currentPurity() {
    if (karatSelect.value === "custom") {
      var custom = number(customPurity.value);
      return custom && custom <= 100 ? custom / 100 : null;
    }
    return parseFloat(karatSelect.value) / 24;
  }

  function render() {
    var weight = number(weightInput.value);
    var purity = currentPurity();
    var spot = number(spotInput.value);
    var paid = number(paidInput.value);

    customPurity.classList.toggle("hidden", karatSelect.value !== "custom");

    if (!weight || !purity) {
      outFine.textContent = "—";
      outFineSub.textContent = "enter a weight and a purity to begin";
      outValue.textContent = "—";
      outValueSub.textContent = "not a valuation of the ring";
      outShare.textContent = "—";
      outShareSub.textContent = "add a price to compare";
      return;
    }

    var fineGold = weight * purity;
    outFine.textContent = grams(fineGold);
    outFineSub.textContent = weight.toFixed(2) + " g at " +
      (purity * 100).toFixed(1) + "% fine gold";

    if (!spot) {
      outValue.textContent = "—";
      outValueSub.textContent = "enter a spot price";
    } else {
      var melt = (fineGold / GRAMS_PER_TROY_OUNCE) * spot;
      outValue.textContent = money(melt);
      outValueSub.textContent = "at " + money(spot) + "/ozt · melt value only, not an appraisal";

      if (paid) {
        var share = (melt / paid) * 100;
        outShare.textContent = share.toFixed(1) + "%";
        outShareSub.textContent = "of the " + money(paid) + " asked; the rest is stone, setting, labour and margin";
      } else {
        outShare.textContent = "—";
        outShareSub.textContent = "add a price to compare";
      }
    }
  }

  [weightInput, customPurity, spotInput, paidInput].forEach(function (element) {
    element.addEventListener("input", render);
  });
  karatSelect.addEventListener("change", render);

  resetButton.addEventListener("click", function () {
    spotInput.value = RECORDED_SPOT.toFixed(2);
    weightInput.value = "";
    paidInput.value = "";
    customPurity.value = "";
    karatSelect.value = "14";
    render();
    weightInput.focus();
  });

  render();
})();
