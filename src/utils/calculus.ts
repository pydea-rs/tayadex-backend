
type ApproximationMethods = 'floor' | 'round' | 'ceil';

export const approximate = (
  num: number,
  method: ApproximationMethods = 'floor',
  precision: number = 2,
) => {
  const precisionTenth = 10 ** precision;
  return Math[method](num * precisionTenth) / precisionTenth;
};
