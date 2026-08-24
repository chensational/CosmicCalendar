import CosmicCalendarCore
import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var locationStore: CosmicLocationStore

    var body: some View {
        TimelineView(.periodic(from: .now, by: 60)) { timeline in
            if let snapshot = try? CosmicCalendarEngine.snapshot(at: timeline.date, observer: locationStore.observer) {
                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {
                        VStack(alignment: .leading, spacing: 5) {
                            Text("COSMIC CALENDAR / APPLE")
                                .font(.caption2.monospaced().weight(.semibold))
                                .foregroundStyle(.secondary)
                            Text("This moment has coordinates.")
                                .font(.system(.largeTitle, design: .serif))
                        }
                        CosmicSkyView(snapshot: snapshot)
                            .frame(minHeight: 310)
                            .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
                            .overlay(alignment: .bottomLeading) {
                                Text("☉ \(snapshot.sun.altitudeDegrees, specifier: "%+.1f")°   ◐ \(snapshot.moon.altitudeDegrees, specifier: "%+.1f")°   ✦ \(snapshot.galacticCenter.altitudeDegrees, specifier: "%+.1f")°")
                                    .font(.caption2.monospaced())
                                    .padding(12)
                            }
                        VStack(alignment: .leading, spacing: 9) {
                            Text("YOU HAVE NEVER BEEN STILL")
                                .font(.caption2.monospaced().weight(.semibold))
                                .foregroundStyle(.secondary)
                            Text(CosmicDistanceFormatter.string(kilometers: snapshot.earthSurfaceDistanceKm))
                                .font(.system(.title, design: .serif))
                            Text("Modeled surface path since Earth formed · \(CosmicDistanceFormatter.string(kilometers: snapshot.earthSurfaceCMBModelDistanceKm)) in the CMB hierarchy model")
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                        }
                        .padding()
                        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 16))
                        Button("Refresh location", systemImage: "location.fill") {
                            locationStore.requestLocation()
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(.teal)
                        if let error = locationStore.errorMessage {
                            Text(error).font(.footnote).foregroundStyle(.red)
                        }
                    }
                    .padding()
                }
                .background(Color(red: 0.015, green: 0.025, blue: 0.065).ignoresSafeArea())
            } else {
                ContentUnavailableView("Ephemeris unavailable", systemImage: "sparkles", description: Text("Choose a modern date and try again."))
            }
        }
    }
}
