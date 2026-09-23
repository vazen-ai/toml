const escapeValue = (item: unknown) =>
  String(item)
    .replaceAll('\\', String.raw`\\`)
    .replaceAll(',', String.raw`\,`);

export const psaStringify = (input: Array<unknown>) =>
  input
    .map((i) => {
      if (Array.isArray(i)) {
        return i.map(escapeValue).join(',');
      }
      return escapeValue(i);
    })
    .join('\n');
