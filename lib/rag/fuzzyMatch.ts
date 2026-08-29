export function levenshteinDistance(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  if (left.length === 0) {
    return right.length;
  }
  if (right.length === 0) {
    return left.length;
  }

  const rows = left.length + 1;
  const cols = right.length + 1;
  const matrix: number[][] = Array.from({ length: rows }, () =>
    Array<number>(cols).fill(0),
  );

  for (let row = 0; row < rows; row += 1) {
    matrix[row]![0] = row;
  }
  for (let col = 0; col < cols; col += 1) {
    matrix[0]![col] = col;
  }

  for (let row = 1; row < rows; row += 1) {
    for (let col = 1; col < cols; col += 1) {
      const cost = left[row - 1] === right[col - 1] ? 0 : 1;
      matrix[row]![col] = Math.min(
        matrix[row - 1]![col]! + 1,
        matrix[row]![col - 1]! + 1,
        matrix[row - 1]![col - 1]! + cost,
      );
    }
  }

  return matrix[left.length]![right.length]!;
}

export function bigramOverlap(left: string, right: string): number {
  if (left === right) {
    return 1;
  }
  if (left.length < 2 || right.length < 2) {
    return 0;
  }

  const leftBigrams = new Map<string, number>();
  for (let index = 0; index < left.length - 1; index += 1) {
    const bigram = left.slice(index, index + 2);
    leftBigrams.set(bigram, (leftBigrams.get(bigram) ?? 0) + 1);
  }

  let overlap = 0;
  for (let index = 0; index < right.length - 1; index += 1) {
    const bigram = right.slice(index, index + 2);
    const count = leftBigrams.get(bigram) ?? 0;
    if (count > 0) {
      overlap += 1;
      leftBigrams.set(bigram, count - 1);
    }
  }

  return (2 * overlap) / (left.length - 1 + (right.length - 1));
}

export function fuzzySimilarity(left: string, right: string): number {
  if (left === right) {
    return 1;
  }
  if (!left || !right) {
    return 0;
  }

  const maxLength = Math.max(left.length, right.length);
  const distance = levenshteinDistance(left, right);
  const normalizedDistance = 1 - distance / maxLength;
  const bigrams = bigramOverlap(left, right);

  return Math.max(0, normalizedDistance * 0.55 + bigrams * 0.45);
}

export function isFuzzySimilar(
  left: string,
  right: string,
  threshold = 0.72,
): boolean {
  if (left.length < 3 || right.length < 3) {
    return left === right;
  }

  const lengthGap = Math.abs(left.length - right.length);
  if (lengthGap > Math.ceil(Math.max(left.length, right.length) * 0.35)) {
    return false;
  }

  return fuzzySimilarity(left, right) >= threshold;
}

export function fuzzyMatchHaystackWords(
  haystackWords: string[],
  needle: string,
  threshold = 0.72,
): boolean {
  if (needle.length < 5) {
    return false;
  }

  for (const word of haystackWords) {
    if (word.length >= 4 && isFuzzySimilar(needle, word, threshold)) {
      return true;
    }
  }

  return false;
}

export function haystackWordsFromText(haystack: string): string[] {
  const seen = new Set<string>();
  const words: string[] = [];

  for (const word of haystack.split(/[^\p{Letter}\p{Number}]+/u)) {
    if (word.length >= 4 && !seen.has(word)) {
      seen.add(word);
      words.push(word);
    }
  }

  return words;
}
