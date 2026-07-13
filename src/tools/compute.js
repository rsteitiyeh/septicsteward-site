// SepticSteward - pumping interval + cost estimate.
// Interval heuristic anchored to the EPA's 3-5 year typical range, adjusted
// for household size, tank size, and disposal use. Cost = common $250-500 range.
export function compute(v) {
  const people = Math.max(1, v.household || 1);
  const tank = v.tank || 1000;
  const disposal = v.disposal === 2;
  // base years: bigger tank per person = longer interval; clamp 1-5
  let years = (tank / (people * 150)) * 2.2;
  if (disposal) years *= 0.7;
  years = Math.max(1, Math.min(5, years));
  const yrsRounded = Math.round(years * 2) / 2;
  const since = v.lastPumped || 0;
  const remaining = yrsRounded - since;
  const status = remaining <= 0 ? 'overdue' : remaining <= 0.5 ? 'due' : 'ok';
  return {
    status,
    outputs: {
      interval: { value: 'about every ' + yrsRounded + ' years' },
      next: { value: remaining <= 0 ? 'now - schedule a pump-out' : 'in about ' + remaining.toFixed(1) + ' years' },
      cost: { value: '$250-$500' }
    }
  };
}
