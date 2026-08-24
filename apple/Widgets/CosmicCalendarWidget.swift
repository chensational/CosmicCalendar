import CosmicCalendarCore
import SwiftUI
import WidgetKit

struct CosmicEntry: TimelineEntry {
    let date: Date
    let snapshot: AppleCosmicSnapshot
}

struct CosmicProvider: TimelineProvider {
    func placeholder(in context: Context) -> CosmicEntry {
        entry(at: .now)
    }

    func getSnapshot(in context: Context, completion: @escaping (CosmicEntry) -> Void) {
        completion(entry(at: .now))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<CosmicEntry>) -> Void) {
        let start = Date()
        let entries = stride(from: 0, through: 60, by: 15).map { minutes in
            entry(at: Calendar.current.date(byAdding: .minute, value: minutes, to: start) ?? start)
        }
        completion(Timeline(entries: entries, policy: .atEnd))
    }

    private func savedObserver() -> CosmicObserver {
        let defaults = UserDefaults(suiteName: "group.com.chensational.cosmiccalendar") ?? .standard
        return CosmicObserver(
            latitude: defaults.object(forKey: "observer.latitude") as? Double ?? CosmicObserver.madison.latitude,
            longitude: defaults.object(forKey: "observer.longitude") as? Double ?? CosmicObserver.madison.longitude,
            elevationMeters: defaults.object(forKey: "observer.elevation") as? Double ?? CosmicObserver.madison.elevationMeters,
            label: defaults.string(forKey: "observer.label") ?? "Saved location"
        )
    }

    private func entry(at date: Date) -> CosmicEntry {
        let observer = savedObserver()
        let snapshot = (try? CosmicCalendarEngine.snapshot(at: date, observer: observer)) ??
            (try! CosmicCalendarEngine.snapshot(at: Date(timeIntervalSince1970: 1_787_443_200), observer: .madison))
        return CosmicEntry(date: date, snapshot: snapshot)
    }
}

struct CosmicWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: CosmicEntry

    var body: some View {
        ZStack {
            ContainerRelativeShape().fill(
                LinearGradient(colors: [Color(red: 0.04, green: 0.08, blue: 0.16), .black], startPoint: .topLeading, endPoint: .bottomTrailing)
            )
            #if os(watchOS) || os(iOS)
            if family == .accessoryCircular {
                accessoryCircular
            } else if family == .accessoryInline {
                Text("☉ \(entry.snapshot.sun.altitudeDegrees, specifier: "%+.0f")° · ◐ \(entry.snapshot.moon.altitudeDegrees, specifier: "%+.0f")°")
            } else if family == .accessoryRectangular {
                accessoryRectangular
            } else {
                systemWidget
            }
            #else
            systemWidget
            #endif
        }
        .containerBackground(for: .widget) { Color.clear }
    }

    private var accessoryCircular: some View {
        Gauge(value: entry.snapshot.moonIlluminatedFraction) {
            Image(systemName: "moonphase.first.quarter")
        } currentValueLabel: {
            Text("\(Int(entry.snapshot.moonIlluminatedFraction * 100))%")
        }
        .gaugeStyle(.accessoryCircular)
    }

    private var accessoryRectangular: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(entry.snapshot.observer.label).font(.caption2).lineLimit(1)
            Text("☉ \(entry.snapshot.sun.altitudeDegrees, specifier: "%+.1f")°  ◐ \(entry.snapshot.moon.altitudeDegrees, specifier: "%+.1f")°")
                .font(.caption.monospacedDigit())
            Text("Never still · \(entry.snapshot.earthSurfaceSpeedKmPerSecond, specifier: "%.2f") km/s")
                .font(.caption2).foregroundStyle(.secondary)
        }
    }

    private var systemWidget: some View {
        VStack(alignment: .leading, spacing: family == .systemSmall ? 7 : 11) {
            HStack {
                Text(entry.date, style: .date).font(.caption2.monospaced().weight(.semibold)).foregroundStyle(.secondary)
                Spacer()
                Image(systemName: "sparkles").foregroundStyle(.teal)
            }
            Text("This moment has\ncoordinates.")
                .font(.system(family == .systemSmall ? .headline : .title2, design: .serif))
            HStack(spacing: 12) {
                Label("\(entry.snapshot.sun.altitudeDegrees, specifier: "%+.1f")°", systemImage: "sun.max.fill").foregroundStyle(.yellow)
                Label("\(entry.snapshot.moon.altitudeDegrees, specifier: "%+.1f")°", systemImage: "moon.fill").foregroundStyle(.white)
            }
            .font(.caption.monospacedDigit())
            if family != .systemSmall {
                Text("Galactic core \(entry.snapshot.galacticCenter.altitudeDegrees, specifier: "%+.1f")° above your horizon")
                    .font(.caption2).foregroundStyle(.secondary)
                Spacer()
                Text(CosmicDistanceFormatter.string(kilometers: entry.snapshot.earthSurfaceDistanceKm))
                    .font(.caption.monospacedDigit())
                Text("modeled surface travel since Earth formed").font(.caption2).foregroundStyle(.secondary)
            }
        }
        .padding()
    }
}

struct CosmicCalendarWidget: Widget {
    let kind = "CosmicCalendarWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: CosmicProvider()) { entry in
            CosmicWidgetView(entry: entry)
        }
        .configurationDisplayName("Cosmic Calendar")
        .description("Your Sun, Moon, Galactic horizon, and cosmic path at a glance.")
        .supportedFamilies(supportedFamilies)
    }

    private var supportedFamilies: [WidgetFamily] {
        #if os(watchOS)
        return [.accessoryCircular, .accessoryRectangular, .accessoryInline]
        #elseif os(iOS)
        return [.systemSmall, .systemMedium, .systemLarge, .systemExtraLarge, .accessoryCircular, .accessoryRectangular, .accessoryInline]
        #elseif os(visionOS)
        return [.systemSmall, .systemMedium, .systemLarge, .systemExtraLarge]
        #else
        return [.systemSmall, .systemMedium, .systemLarge, .systemExtraLarge]
        #endif
    }
}

@main
struct CosmicCalendarWidgetBundle: WidgetBundle {
    var body: some Widget { CosmicCalendarWidget() }
}
