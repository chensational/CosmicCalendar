import CosmicCalendarCore
import Foundation

enum VerificationFailure: Error, CustomStringConvertible {
    case check(String)
    var description: String {
        switch self { case .check(let message): return message }
    }
}

func check(_ condition: @autoclosure () -> Bool, _ message: String) throws {
    if !condition() { throw VerificationFailure.check(message) }
}

do {
    let date = ISO8601DateFormatter().date(from: "2026-08-23T00:00:00Z")!
    let snapshot = try CosmicCalendarEngine.snapshot(at: date, observer: .madison)
    try check(abs(snapshot.sun.azimuthDegrees - 278.391508) < 0.2, "Sun azimuth differs from JPL Horizons fixture")
    try check(abs(snapshot.sun.altitudeDegrees - 7.895707) < 0.3, "Sun altitude differs from JPL Horizons fixture")
    try check((0...1).contains(snapshot.moonIlluminatedFraction), "Moon illumination is outside [0, 1]")

    let equator = CosmicCalendarEngine.earthSurfaceRotationSpeedKmPerSecond(latitudeDegrees: 0)
    let wisconsin = CosmicCalendarEngine.earthSurfaceRotationSpeedKmPerSecond(latitudeDegrees: 43.0731)
    let pole = CosmicCalendarEngine.earthSurfaceRotationSpeedKmPerSecond(latitudeDegrees: 90)
    try check(equator > wisconsin, "Latitude model does not make equator faster than Wisconsin")
    try check(abs(pole) < 1e-12, "Latitude model does not approach zero at the pole")
    try check(snapshot.earthSurfaceCMBModelDistanceKm > snapshot.earthSurfaceDistanceKm, "CMB hierarchy is not larger than local surface path")
    try check(!CosmicDistanceFormatter.string(kilometers: snapshot.earthSurfaceDistanceKm).isEmpty, "Distance formatter returned an empty string")

    print("CosmicCalendarCore verification passed (8 checks).")
} catch {
    fputs("CosmicCalendarCore verification failed: \(error)\n", stderr)
    exit(1)
}
