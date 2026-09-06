# Oct Track Web

Static HTML, CSS, and JavaScript tariff tracker ready for GitHub Pages.

## Run locally

Open `index.html` directly in a browser, or serve the folder with any static server:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Deploy to GitHub Pages

1. Create a new GitHub repository.
2. Push this project folder as the repository root.
3. In GitHub, open `Settings > Pages`.
4. Set `Build and deployment > Source` to `GitHub Actions`.
5. Push to `main`; the included workflow deploys the static site automatically.

The app has no build step. It fetches public Octopus Energy API data directly from the browser.

## Files

- `index.html` - semantic page structure, dialogs, menu, dashboard cards.
- `styles.css` - responsive visual system matching the v2 Flutter and SwiftUI theme.
- `app.js` - settings persistence, Octopus API calls, tariff extraction, validation, notifications.
- `TECHNICAL_REPORT.md` - implementation specification for rebuilding the app in another stack.

## v2 visual update

The root web app has been visually re-designed to match the `oct_track_v2` application:

- Deep navy-purple background with the warm top glow and title gradient used by v2.
- Frosted translucent cards with blur, continuous rounded corners, and accent borders.
- Matching electricity blue and gas purple card treatments, rate colors, menu popover, modal surfaces, and action states.
- Responsive spacing and focus/hover states tuned for the same mobile-first presentation.

This update includes the v2 visual treatment and related web functionality. It adds Gas visibility settings, 7/14-day electricity history with an interactive chart, Flexible Octopus comparison, and Today/Tomorrow trend indicators. Google ad/banner placeholders have been removed, and Buy me a coffee is now the final item in the Menu. Existing postcode validation, supported plans, tariff extraction, notifications, dialogs, and the privacy-policy link remain available.
