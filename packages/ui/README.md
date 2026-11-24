# `@klipklop/ui`

Shared, **color-agnostic** control template for KlipKlop hub apps.

Shape, spacing, type, and interaction live here. **Color identity is injected** by each customer/division via CSS variables (`--kk-*`).

## Install in an app

From a Vite app (path import — no publish step):

```js
// vite.config.js
import path from 'node:path'
export default {
  resolve: {
    alias: {
      '@klipklop/ui': path.resolve(__dirname, '../../packages/ui/src'),
    },
  },
}
```

```js
import '@klipklop/ui/index.css'
import { Button, Input, applyPreset } from '@klipklop/ui'

applyPreset('sawmga') // or applyTheme({ accent: '#…', accentInk: '#…' })
```

## Inject identity

Only override what you need. Accent is the main brand lever:

```js
import { applyTheme } from '@klipklop/ui'

applyTheme({
  accent: '#166534',
  accentHover: '#14532d',
  accentSoft: '#dcfce7',
  accentInk: '#f0fdf4',
  ring: '#166534',
})
```

Or set CSS directly:

```css
:root {
  --kk-accent: #c4a35a;
  --kk-accent-ink: #1c1710;
  --kk-accent-soft: #f3e8cb;
  --kk-accent-hover: #b08d45;
}
```

Built-in presets: `neutral`, `sawmga`, `brsa`, `hub` (`THEME_PRESETS` / `applyPreset`).

## Controls

React: `Button`, `Input`, `Select`, `Textarea`, `Field`, `Badge`, `Card*`, `Tabs`, `PageHeader`, `EmptyState`, `Table*`, `Modal`.

Plain HTML/CSS: use the same `kk-*` classes from `controls.css`.

**Staff playground:** [`apps/admin`](../../apps/admin) → https://klipklop-admin.klipklop.workers.dev (gated).

## Rules

- Components must not hard-code brand greens/golds — only `--kk-*` tokens.
- Status colors (`danger` / `success` / `warning`) are semantic and still overridable.
- Apps own fonts if they want; defaults are Figtree + Fraunces via tokens.
