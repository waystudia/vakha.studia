export function normalizeChildName(value: string) {
  return value.toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/[’'ʼ]/g, '').replace(/[-‐‑–—]/g, ' ').trim().replace(/\s+/g, ' ');
}
function closeWord(a: string, b: string) {
  if (a === b) return true;
  if (a.length < 2 || b.length < 2) return false;
  if (a.startsWith(b) || b.startsWith(a)) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = row[0]; row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const old = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + Number(a[i - 1] !== b[j - 1]));
      diagonal = old;
    }
  }
  return row[b.length] <= 1;
}
export function similarChildren<T extends { public_name: string }>(children: T[], query: string): T[] {
  const words = normalizeChildName(query).split(' ').filter(word => word.length >= 2);
  if (!words.length) return [];
  return children.filter(child => {
    const name = normalizeChildName(child.public_name).split(' ');
    return words.every(word => name.some(part => closeWord(word, part)));
  });
}
