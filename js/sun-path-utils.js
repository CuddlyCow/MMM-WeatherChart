(function (global) {
  "use strict";

  // ==================== SONNENVERLAUF-GEOMETRIE ====================
  // Bogen als Kreissegment: Start-/Endpunkt liegen auf der Basislinie, der
  // Scheitelpunkt oben in der Mitte. Für einen Öffnungswinkel sweepDeg gilt
  // mit Sehnenbreite c und Halbwinkel α = sweepDeg/2: r = c / (2·sin α) und
  // die Pfeilhöhe (Sagitta) h = (c/2)·tan(α/2).
  const sunPathUtils = {
    /**
     * Berechnet die Bogengeometrie für ein SVG mit gegebener Breite/Höhe.
     * @param {number} width - Breite des SVG-Viewports.
     * @param {number} baselineY - Y-Position der Basislinie (Sonnenauf-/-untergang).
     * @param {number} insetX - Horizontaler Abstand der Endpunkte vom Rand.
     * @param {number} sweepDeg - Öffnungswinkel des Bogens in Grad.
     * @returns {{p1: object, p2: object, radius: number, centerX: number, centerY: number, sweepDeg: number}}
     */
    getArcGeometry(width, baselineY, insetX, sweepDeg = 120) {
      const chordWidth = width - insetX * 2;
      const halfSweepRad = ((sweepDeg / 2) * Math.PI) / 180;
      const radius = chordWidth / 2 / Math.sin(halfSweepRad);
      const centerX = width / 2;
      const centerY = baselineY + radius * Math.cos(halfSweepRad);

      return {
        p1: { x: insetX, y: baselineY },
        p2: { x: width - insetX, y: baselineY },
        radius,
        centerX,
        centerY,
        sweepDeg
      };
    },

    /**
     * Erzeugt das "d"-Attribut für den Bogenpfad (im Uhrzeigersinn).
     */
    getArcPath(geometry) {
      const { p1, p2, radius } = geometry;
      return `M ${p1.x} ${p1.y} A ${radius} ${radius} 0 0 1 ${p2.x} ${p2.y}`;
    },

    /**
     * Position auf dem Bogen für einen Fortschritt zwischen 0 (Sonnenaufgang)
     * und 1 (Sonnenuntergang).
     */
    getPointOnArc(geometry, progress) {
      const clamped = Math.min(1, Math.max(0, progress));
      const startAngleDeg = 90 + geometry.sweepDeg / 2;
      const angleDeg = startAngleDeg - geometry.sweepDeg * clamped;
      const angleRad = (angleDeg * Math.PI) / 180;

      return {
        x: geometry.centerX + geometry.radius * Math.cos(angleRad),
        y: geometry.centerY - geometry.radius * Math.sin(angleRad)
      };
    },

    /**
     * Tagesfortschritt zwischen Sonnenaufgang und -untergang.
     * @param {number} nowSeconds - Aktuelle Zeit (Unix-Sekunden).
     * @param {number} sunriseSeconds
     * @param {number} sunsetSeconds
     * @returns {{progress: number, isDaytime: boolean}}
     */
    getSunProgress(nowSeconds, sunriseSeconds, sunsetSeconds) {
      const span = sunsetSeconds - sunriseSeconds;
      if (!Number.isFinite(span) || span <= 0) {
        return { progress: 0, isDaytime: false };
      }

      const progress = (nowSeconds - sunriseSeconds) / span;
      return {
        progress: Math.min(1, Math.max(0, progress)),
        isDaytime: nowSeconds >= sunriseSeconds && nowSeconds <= sunsetSeconds
      };
    }
  };

  global.MMMWeatherChartSunPathUtils = sunPathUtils;
})(window);
