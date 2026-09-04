const GRADES = new Set([
  "",
  "peuters",
  "k1",
  "k2",
  "k3",
  "l1",
  "l2",
  "l3",
  "l4",
  "l5",
  "l6",
  "s1",
  "s2",
  "s3",
  "s7",
  "custom",
]);
const SECONDARY_GRADES = new Set([
  "all",
  "1ste_graad",
  "2de_graad",
  "3de_graad",
  "7de_specialisatie",
]);
const SECONDARY_FINALITIES = new Set([
  "all",
  "doorstroom",
  "dubbel",
  "arbeidsmarkt",
]);

export function isValidRagTargetContext(value: {
  grade?: unknown;
  ageRange?: unknown;
  secondaryGrade?: unknown;
  secondaryFinality?: unknown;
  domainDetail?: unknown;
  domainFinality?: unknown;
}) {
  if (value.grade !== undefined && !GRADES.has(String(value.grade))) {
    return false;
  }
  if (
    value.secondaryGrade !== undefined &&
    !SECONDARY_GRADES.has(String(value.secondaryGrade))
  ) {
    return false;
  }
  if (
    value.secondaryFinality !== undefined &&
    !SECONDARY_FINALITIES.has(String(value.secondaryFinality))
  ) {
    return false;
  }

  return [
    value.ageRange,
    value.domainDetail,
    value.domainFinality,
  ].every(
    (field) =>
      field === undefined ||
      (typeof field === "string" &&
        field.length <= 100 &&
        !/[\p{C}<>]/u.test(field)),
  );
}
