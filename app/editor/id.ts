let counter = 0;

export function makeId(prefix = "n"): string {
  counter += 1;
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${counter.toString(36)}_${rand}`;
}
