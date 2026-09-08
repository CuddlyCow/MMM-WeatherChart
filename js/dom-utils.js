(function (global) {
  "use strict";

  // ==================== DOM/CSS-UTILITIES ====================
  const domUtils = {
    /**
     * Liest den Wert einer CSS-Custom-Property vom Dokument-Root.
     * @param {string} variableName - Name der CSS-Variable (z. B. "--color-text").
     * @param {string} fallbackValue - Rückgabewert, falls die Variable nicht gesetzt ist.
     * @returns {string} Wert der CSS-Variable oder der Fallback-Wert.
     */
    getCssVariable(variableName, fallbackValue) {
      const rootStyles = getComputedStyle(document.documentElement);
      return rootStyles.getPropertyValue(variableName).trim() || fallbackValue;
    },

    /**
     * Ermittelt die aufgelöste Pixelgröße einer CSS-Font-Size-Variable.
     * Erzeugt dafür ein unsichtbares Sondierungs-Element, da CSS-Variablen
     * nicht direkt in Pixel umgerechnet werden können.
     * @param {string} variableName - Name der CSS-Variable (z. B. "--font-size-small").
     * @param {string} fallbackValue - CSS-Fallback-Wert (z. B. "1rem").
     * @returns {number} Schriftgröße in Pixel.
     */
    getCssFontSize(variableName, fallbackValue) {
      const probe = document.createElement("span");
      probe.style.fontSize = `var(${variableName}, ${fallbackValue})`;
      probe.style.position = "absolute";
      probe.style.visibility = "hidden";
      probe.style.pointerEvents = "none";
      document.body.appendChild(probe);
      const fontSize = parseFloat(getComputedStyle(probe).fontSize);
      probe.remove();
      return Number.isFinite(fontSize) ? fontSize : parseFloat(fallbackValue);
    }
  };

  global.MMMWeatherChartDomUtils = domUtils;
})(window);
