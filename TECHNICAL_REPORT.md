# Oct Track Technical Specification

## 1. Product Overview

Oct Track is an independent tariff companion that lets a user enter a UK postcode and select a supported Octopus-style tariff product code, then view the current day and next day unit rates for electricity and gas. The source application is a SwiftUI iOS app named `OctTrackApp` with bundle identifier `com.Ltc.OctTrack`.

The web replication in this folder preserves the same user-facing core: persisted settings, tariff lookup, current/tomorrow cards, refresh action, settings dialog, disclaimer dialog, privacy-policy link, and notification when tomorrow's rate changes.

## 2. Source Application Inventory

| Source file | Responsibility |
| --- | --- |
| `OctopusTariffAppApp.swift` | App entry point, Google Mobile Ads startup, notification permission request, background refresh registration and scheduling. |
| `ContentView.swift` | Main SwiftUI dashboard, custom menu, settings/disclaimer/privacy presentation, ATT request, ad banner placement, refresh lifecycle. |
| `SettingsView.swift` | Postcode and tariff-plan settings form, plan list, postcode validation through region lookup, product-name loading. |
| `TariffFetcher.swift` | Observable view model, Octopus API integration, region lookup, tariff fetching, notification trigger for changed tomorrow rates. |
| `Models.swift` | Decodable API response models for tariff rates and grid supply points. |
| `Theme.swift` | Shared color and typography tokens. |
| `Date+OnlyDate.swift` | Date helpers for day-level comparison. |
| `DisclaimerView.swift` | Static independent-app disclaimer. |
| `SafariView.swift` | In-app Safari wrapper for privacy policy. |
| `AdMobHelper.swift` | Google Mobile Ads banner creation, loading, and SwiftUI bridge. |
| `Info.plist` | AdMob app identifier, tracking usage text, SKAdNetwork entries, portrait-only/full-screen iPhone configuration. |

## 3. Platform and Dependency Specification

### iOS App

- Language/framework: Swift, SwiftUI.
- Minimum deployment target found in the Xcode project: iOS 18.5.
- Main target marketing version: 1.3.
- App orientation: portrait only.
- Device family: iPhone.
- External SDK: Google Mobile Ads.
- Apple frameworks: `UserNotifications`, `BackgroundTasks`, `AppTrackingTransparency`, `AdSupport`, `SafariServices`.
- Persistent storage: `UserDefaults` through `@AppStorage` and direct `UserDefaults.standard` access.

### Static Web Version

- Runtime: browser only.
- Dependencies: optional Lucide icon UMD script loaded from CDN for icon parity.
- Storage: `localStorage`.
- Network: browser `fetch`.
- Notifications: Web Notifications API.
- Deployment: static hosting such as GitHub Pages, no build step.

## 4. Data Sources and API Contracts

Base URL:

```text
https://api.octopus.energy/v1/
```

### Product Name Lookup

Request:

```text
GET /v1/products/{PLAN_CODE}/
```

Used fields:

- `full_name`: full product name.
- `display_name`: product display name.

Display rule:

1. If `full_name` exists and contains `display_name`, remove the first display-name occurrence.
2. Trim whitespace, colon, and dash characters from both ends.
3. If no product name is available, show `Plan Code: {PLAN_CODE}`.

### Region Lookup

Request:

```text
GET /v1/industry/grid-supply-points/?postcode={URL_ENCODED_POSTCODE}
```

Used fields:

- `results[0].group_id`

Region rule:

1. Require at least one result.
2. Read `group_id`.
3. Trim leading/trailing underscore characters.
4. Uppercase the result.

Error cases:

- Invalid URL.
- Invalid JSON.
- Empty `results`.
- Missing `group_id`.

### Electricity Tariff Lookup

Request:

```text
GET /v1/products/{PLAN_CODE}/electricity-tariffs/E-1R-{PLAN_CODE}-{REGION}/standard-unit-rates/
```

### Gas Tariff Lookup

Request:

```text
GET /v1/products/{PLAN_CODE}/gas-tariffs/G-1R-{PLAN_CODE}-{REGION}/standard-unit-rates/
```

Used tariff fields:

- `valid_from`: ISO 8601 timestamp.
- `valid_to`: ISO 8601 timestamp.
- `value_inc_vat`: unit price in p/kWh.

Tariff extraction rule:

1. Sort `results` by `valid_from` descending.
2. Inspect only the latest five records.
3. Compare each record's date-only value with today and tomorrow.
4. Set `todayRate` from the first matching today record.
5. Set `tomorrowRate` from the first matching tomorrow record.
6. Display rates to two decimal places.

The iOS app uses `Calendar.current` for date-only comparison. The web version uses `Europe/London` date keys to match the UK tariff domain and the original app's expected locale.

## 5. Supported Tariff Plans

The settings screen offers these product codes:

- `SILVER-24-04-03`
- `SILVER-24-07-01`
- `SILVER-24-10-01`
- `SILVER-24-12-31`
- `SILVER-25-04-11`
- `SILVER-25-04-15`
- `SILVER-25-09-02`

Each plan option is displayed as:

```text
{trimmed full product name} ({PLAN_CODE})
```

While names are loading:

```text
Loading... ({PLAN_CODE})
```

## 6. State Model

Persisted user settings:

- `postcode`: string.
- `plan`: string.
- `electricityTomorrowRate`: double/string numeric cache for notification comparison.
- `gasTomorrowRate`: double/string numeric cache for notification comparison.
- `isPremiumUser`: iOS-only boolean controlling ad display. It exists in the source app but no purchase flow is present in the reviewed source.

Runtime state:

- Product full name and display name.
- Electricity today rate.
- Electricity tomorrow rate.
- Electricity loading/error state.
- Gas today rate.
- Gas tomorrow rate.
- Gas loading/error state.
- Menu visibility.
- Settings/disclaimer/privacy presentation.
- ATT-requested guard in the iOS view.

## 7. Functional Requirements

### First Launch / Missing Setup

- Show app title and subtitle.
- If either postcode or plan is missing, show:

```text
Let's get you set up!
Please go to menu at the top right corner and enter your postcode and tariff plan.
```

- No tariff cards are shown until setup is complete.

### Settings

- Open from the top-right menu.
- Postcode input autocapitalizes.
- Tariff plan picker uses the supported plan list.
- Save is disabled when the postcode is empty.
- On save, validate the postcode by calling the region lookup endpoint.
- If validation succeeds, persist postcode/plan and dismiss settings.
- If validation fails, show:

```text
Invalid postcode. Please enter a valid UK postcode.
```

### Dashboard Refresh

- Trigger refresh on app appear if settings exist.
- Trigger refresh when postcode changes.
- Trigger refresh when plan changes.
- Trigger refresh when user taps `Refresh`.
- Fetch product name, electricity tariff, and gas tariff.
- Electricity and gas tariff calls are logically concurrent.
- Show loading text while either tariff fetch is active:

```text
Gathering today's rates...
```

### Rate Display

Electricity card:

- Header: `Electricity Tariff`.
- Icon intent: bolt.
- Accent: blue.
- Today rate: large green number.
- Tomorrow rate: medium orange number.

Gas card:

- Header: `Gas Tariff`.
- Icon intent: flame.
- Accent: purple.
- Today rate: large green number.
- Tomorrow rate: medium orange number.

Unavailable today:

```text
Today's price: Not available
```

Unavailable tomorrow:

```text
Tomorrow's price not available yet.
Check back soon!
```

### Error Handling

Electricity failure message:

```text
Failed to load electricity tariff. {error}
```

Gas failure message:

```text
Failed to load gas tariff. {error}
```

The iOS implementation also shows a retry button inside each error block. The web version keeps the global refresh button visible for retry once setup is complete.

### Notifications

iOS:

- Requests notification authorization during app initialization.
- When tomorrow's electricity or gas rate changes from the stored previous value, persist the new value and schedule an immediate local notification.
- Notification title:

```text
Tomorrow {tariffType} tariff available!
```

- Notification body:

```text
Tomorrow price is {price}p/kWh.
```

Web:

- Uses the same rate-change comparison with `localStorage`.
- Requests browser notification permission only when a changed tomorrow rate is detected.
- Shows the same title/body through the Web Notifications API if granted.

### Background Refresh

iOS:

- Registers `com.Ltc.OctTrack.fetchTariff` with `BGTaskScheduler`.
- Schedules `BGAppRefreshTaskRequest` when the scene enters background.
- Earliest begin date is 15 minutes from scheduling.
- Handler loads stored postcode/plan and calls `fetchAllTariffs`.

Static web:

- No true background refresh because GitHub Pages cannot run background jobs.
- Refresh occurs on page load, settings save, and manual refresh.

### Ads and Tracking

iOS:

- Starts Google Mobile Ads in app initialization.
- Requests App Tracking Transparency authorization from `ContentView`.
- Creates an AdMob banner after ATT flow.
- Debug ad unit: `ca-app-pub-3940256099942544/2934735716`.
- Production ad unit: `ca-app-pub-2732183844652650/1051513123`.
- Banner height: 50 points.
- Banner is hidden for `isPremiumUser == true`.

Static web:

 Google ad/banner integration is not included in the root web app.
 Buy me a coffee is rendered at the bottom of the application menu.

 The bottom area does not reserve space for a Google banner ad.
 Support is available from the Buy me a coffee action in the application menu.
Disclaimer text must state that the app is independently developed, not affiliated with or endorsed by an energy provider, uses public sources for reference only, and accepts no liability for reliance.

Privacy policy opens:

```text
https://tcvinlee.github.io/iOS_tracking_octo_public/privacy.html
```

## 8. UI Design Specification

### Visual Identity

- App name: `Oct Track`.
- Overall mood: dark, glowing, rounded, independent utility.
- Background color: `#181836`.
- Warm top glow: vertical gradient from translucent pink to transparent.
- Main title gradient: magenta to teal to pink.

### Color Tokens

| Token | Value / behavior |
| --- | --- |
| Background | `rgb(24, 24, 54)` / `#181836` |
| Accent | `#FF00FF` |
| Secondary highlight | `rgb(102, 255, 204)` / `#66FFCC` |
| Card background | white at 8% opacity |
| Card overlay | vertical white 10% opacity to transparent |
| Primary text | white |
| Secondary text | white at 70% opacity |
| Error | red |
| Success | green |
| Warning | orange |
| Electricity card accent | blue |
| Gas card accent | purple |

### Typography

iOS uses system rounded design:

- Heading: system rounded, bold.
- Body: system rounded, regular.
- Caption: system rounded, medium.
- Button: system rounded, semibold.

Web equivalent:

```css
font-family: ui-rounded, "SF Pro Rounded", "Avenir Next Rounded", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
```

Key sizes:

- App title: 28 px.
- Subtitle: 14 px.
- Card heading: 20-22 px.
- Today price: 36 px.
- Tomorrow price: 28 px.
- Body: 16-18 px.
- Caption/error: 14-15 px.
- Buttons: 20 px on iOS, 16-18 px web equivalent with strong weight.

### Layout

- Root uses a full-screen dark background.
- Main content is vertically scrollable.
- Header has a top-right menu button.
- Content is centered with horizontal padding.
- Cards stack vertically with 12-20 px spacing.
- Bottom area reserves space for a 50 px banner ad.
- On iOS, bottom padding is 70 px for non-premium users and 20 px for premium users.
- Web shell uses fixed bottom ad placeholder and content padding.

### Card Component

Card structure:

- Rounded rectangle, continuous corner style.
- Corner radius: 24 px/pt.
- Fill: translucent white.
- Overlay: subtle top-to-bottom white highlight.
- Stroke: 2 px accent color.
- Shadow: low-opacity accent shadow, radius around 6.
- Content padding: 16 px/pt.

### Menu

- Trigger: top-right menu button with menu icon and label.
- Popover width: 190 px.
- Position: top-right below nav bar.
- Border: 2 px gradient from magenta to teal.
- Background: app background color.
- Corner radius: 18 px.
- Shadow: magenta at 18% opacity, radius 10, y offset 4.
- Items: Settings, Disclaimer, Privacy Policy.
- Item icon colors alternate accent/secondary.

### Settings Modal

- Full-screen navigation view on iOS; modal dialog on web.
- Dark background with warm glow.
- Circular gear icon at top.
- Heading: `Settings`.
- Form sections:
  - `Postcode` with uppercase text field.
  - `Tariff Plan` with picker/select.
- Save button:
  - Leading checkmark/badge icon.
  - Magenta background at 80% opacity.
  - Rounded 16 px corner.
  - Disabled when postcode is blank.

## 9. Architecture for Reimplementation

Recommended modules for any target stack:

- `SettingsStore`: read/write postcode, plan, and cached tomorrow rates.
- `OctopusApiClient`: product lookup, region lookup, electricity tariff lookup, gas tariff lookup.
- `TariffService`: compose region and tariff endpoints, sort/filter records, return today/tomorrow view model.
- `NotificationService`: permission and changed-rate notification.
- `DashboardView`: render setup state, loading state, errors, plan card, rate cards, refresh control.
- `SettingsView`: edit and validate user settings.
- `LegalViews`: disclaimer and privacy link.

Suggested tariff service pseudocode:

```text
function fetchTariff(type, postcode, plan):
  region = fetchRegionCode(postcode)
  tariffCode = type == electricity
    ? "E-1R-{PLAN}-{REGION}"
    : "G-1R-{PLAN}-{REGION}"
  records = fetch standard-unit-rates endpoint
  latestFive = records sorted by valid_from descending take 5
  today = current local date
  tomorrow = today + 1 day
  return {
    today: first record whose valid_from date == today,
    tomorrow: first record whose valid_from date == tomorrow
  }
```

## 10. Known Limitations and Risks

- The app assumes single-rate tariffs with `E-1R` and `G-1R` code patterns.
- The latest-five-record scan mirrors the source app but may miss data if API ordering or product structure changes.
- The source app does not include a premium purchase flow, although `isPremiumUser` controls ad visibility.
- Background refresh requires iOS entitlements and permitted task identifiers; those are not represented in a static web deployment.
- Browser notifications on GitHub Pages require HTTPS, user permission, and active browser support.
- Public API access depends on Octopus Energy CORS behavior for browser clients.

## 10.1 Root web UI parity update

The root static web app was updated to match the visual language and relevant functionality implemented in `oct_track_v2`. The implementation spans `index.html`, `app.js`, and `styles.css`.

The web presentation now follows the v2 design tokens and component treatment:

- `#181836` background with a warm translucent top glow and magenta/teal title gradient.
- Frosted translucent surfaces with backdrop blur, white overlay, continuous `24px` corners, and accent strokes.
- Blue electricity cards, purple gas cards, green today rates, orange tomorrow rates, and magenta primary actions.
- Matching menu popover border treatment, modal backdrop, settings fields, focus states, and responsive spacing.
- A v2-style dashboard composition with a brand kicker, live-status badge, current-plan identity card, energy grid, setup action, and rate refresh action.

The DOM hooks used by the data and API logic were preserved. Existing API endpoints, tariff extraction, notification behavior, postcode validation, supported plans, dialogs, and the privacy-policy destination remain available.

The web implementation now also includes:

- `showGas` preference in `localStorage`, with a Settings toggle that conditionally renders and fetches the Gas tariff.
- `historyDays` preference with 7-day and 14-day options. Electricity history uses the standard-unit-rates endpoint with `period_from` and `period_to` query parameters.
- An interactive Chart.js history chart with the electricity tariff and Flexible Octopus reference line.
- Flexible Octopus lookup using product `VAR-22-11-01`, region-specific electricity tariff code, and `DIRECT_DEBIT` filtering.
- Current electricity versus Flexible comparison, expressed as cheaper, more expensive, or matching with a percentage difference.
- Today versus Tomorrow trend indicators for electricity and gas.
- Removal of Google ad/banner placeholders. The Buy me a coffee script is now rendered as the final item in the application menu.

The web version cannot guarantee iOS-style background refresh after the browser is closed, but all new foreground fetches and interactions are implemented in JavaScript.

## 11. Acceptance Checklist

- User can open the app without setup and see setup guidance.
- User can open Settings, enter a valid UK postcode, select a supported plan, and save.
- Invalid postcode shows a validation error and does not save.
- Product name loads and displays in the plan card.
- Electricity card shows today's and tomorrow's p/kWh values when API data exists.
- Gas card shows today's and tomorrow's p/kWh values when API data exists.
- Missing tomorrow data shows the source app's "Check back soon" message.
- API failures display readable errors.
- Refresh button repeats the lookup.
- Menu opens Settings, Disclaimer, and Privacy Policy.
- Settings persist across reloads/app launches.
- Tomorrow-rate change can trigger a notification after permission is granted.
