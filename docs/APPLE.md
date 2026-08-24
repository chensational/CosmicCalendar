# Apple app and widget setup

Cosmic Calendar provides native SwiftUI/WidgetKit code for all WidgetKit-capable Apple device families. The calculation layer is a Swift package backed by Astronomy Engine's C implementation, so native widgets are offline and do not run a web view.

## Requirements

- Xcode 26 or newer for the native visionOS 26 widget target. Xcode 16 can still build the iOS/iPadOS, macOS, watchOS, and pre-widget visionOS app surfaces.
- An Apple Developer team for device installation and App Group entitlements.
- Bundle/App Group identifiers available to that team.

## Open and sign

1. Open `apple/CosmicCalendar.xcodeproj`.
2. Select each app and widget target under **Signing & Capabilities**.
3. Choose your development team.
4. Register `group.com.chensational.cosmiccalendar`, or replace it consistently in:
   - `apple/App/CosmicCalendar.entitlements`
   - `apple/Widgets/CosmicCalendarWidget.entitlements`
   - `apple/App/CosmicLocationStore.swift`
   - `apple/Widgets/CosmicCalendarWidget.swift`
5. Build one of the shared schemes: `CosmicCalendarPhone`, `CosmicCalendarMac`, `CosmicCalendarWatch`, or `CosmicCalendarVision`.

The `.xcodeproj` is generated reproducibly from `apple/project.yml` with XcodeGen 2.46.0:

```bash
brew install xcodegen
cd apple
xcodegen generate
```

## Location lifecycle and privacy

Widget extensions cannot prompt for continuous location independently. The container app requests **When In Use** permission only after the user taps **Refresh location**, then persists coarse coordinates into the shared App Group. Widget timelines read that local value and refresh every 15 minutes. There is no remote API, analytics SDK, or location upload.

If location is denied or the app has never run, Madison, Wisconsin is the transparent default. The widget identifies it as a saved/default location rather than pretending it is the device position.

## Widget families

- iPhone/iPad: small, medium, large, extra-large where the OS supports it, plus accessory circular/rectangular/inline families.
- Mac: small, medium, large, and extra-large Desktop/Notification Center families where supported.
- Apple Watch: accessory circular, rectangular, and inline families for complications and Smart Stack.
- visionOS: system small through extra-large.

Apple TV has no public WidgetKit family. AirPods and other accessories do not host third-party widgets directly.

## Local verification

The platform-independent native core can be verified without the full Xcode app:

```bash
npm run apple:test
```

That command compiles the 480 KB C ephemeris engine and Swift wrapper, then checks the JPL Sun fixture, Moon fraction bounds, WGS84 latitude behavior, distance hierarchy, and formatting. Full UI/widget compilation requires Xcode rather than Command Line Tools.
