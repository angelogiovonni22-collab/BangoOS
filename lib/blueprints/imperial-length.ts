const METERS_TO_INCHES = 39.37007874015748;

function gcd(a: number, b: number): number {
  let left = Math.abs(Math.round(a));
  let right = Math.abs(Math.round(b));
  while (right) [left, right] = [right, left % right];
  return left || 1;
}

export function formatBlueprintFeetInches(meters: number, denominator = 8) {
  if (!Number.isFinite(meters) || meters < 0) return "—";
  const safeDenominator = [2, 4, 8, 16].includes(denominator) ? denominator : 8;
  let eighths = Math.round(meters * METERS_TO_INCHES * safeDenominator);
  const unitsPerFoot = 12 * safeDenominator;
  let feet = Math.floor(eighths / unitsPerFoot);
  eighths -= feet * unitsPerFoot;
  let inches = Math.floor(eighths / safeDenominator);
  let numerator = eighths - inches * safeDenominator;
  if (inches >= 12) {
    feet += Math.floor(inches / 12);
    inches %= 12;
  }
  if (numerator === safeDenominator) {
    inches += 1;
    numerator = 0;
  }
  if (inches === 12) {
    feet += 1;
    inches = 0;
  }
  const fraction = numerator > 0
    ? (() => {
        const divisor = gcd(numerator, safeDenominator);
        return ` ${numerator / divisor}/${safeDenominator / divisor}`;
      })()
    : "";
  return `${feet}'-${inches}${fraction}\"`;
}
