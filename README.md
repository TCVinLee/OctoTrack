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
- `styles.css` - responsive visual system matching the iOS SwiftUI theme.
- `app.js` - settings persistence, Octopus API calls, tariff extraction, validation, notifications.
- `TECHNICAL_REPORT.md` - implementation specification for rebuilding the app in another stack.
