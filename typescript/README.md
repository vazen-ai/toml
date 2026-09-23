# @vazen-ai/toml

Vazen TOML planogram tooling. This development release writes PSA files.

```js
import { psaStringify } from '@vazen-ai/toml';

console.log(psaStringify([['Fictional item A', 'Shelf, left']]));
// Fictional item A,Shelf\, left
```

ESM only, for Node.js 24 or later, with Effect as a peer dependency.

From this directory, run `npm ci`, then `npm run verify` to check, test, build
and lint the package.

See [licensing](https://github.com/vazen-ai/toml/blob/main/LICENSING.md).
