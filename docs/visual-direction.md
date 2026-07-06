# Padoka100 visual direction

Padoka100 should feel like a simple daily-use sales app for a bakery business, not an admin dashboard.

## Principles

- Mobile first, with comfortable touch targets and readable text.
- Warm bakery palette: red/orange brand color, cream surfaces, soft borders, calm success and warning colors.
- Clear hierarchy: the next action should be obvious, especially on the sales screen.
- Friendly Portuguese copy, with technical details kept out of the main selling flow.
- Cards should be soft, spacious, and easy to scan.
- Product placeholders should feel food-related when real photos are missing.
- Desktop keeps the app shape instead of becoming a dense dashboard.

## Core surfaces

- `AppHeader` keeps the brand visible and sends settings to an icon action.
- `BottomNavigation` shows a few big fixed tabs on mobile; extra destinations live under a "Mais" sheet instead of a side-scrolling row.
- `SalesModePage` is the primary experience: a day hero, big product cards with quantity steppers, a floating cart bar, and a clear sale button.
- `CardDiaAtual`, `CardProduto`, `BarraCarrinho`, and `SacolaSheet` are the reference components for the selling flow.

## Avoid

- Visible labels like Railway, Online, Primeira tela, or endpoint language in the main app flow.
- Small text on primary actions.
- Large flat color blocks for products without imagery.
- Nested card layouts and dense dashboard styling.
