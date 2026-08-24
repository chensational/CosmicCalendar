import CAstronomyEngine
import Foundation

public struct CosmicObserver: Sendable, Codable, Equatable {
    public var latitude: Double
    public var longitude: Double
    public var elevationMeters: Double
    public var label: String

    public init(latitude: Double, longitude: Double, elevationMeters: Double = 0, label: String = "Your location") {
        self.latitude = min(90, max(-90, latitude))
        self.longitude = min(180, max(-180, longitude))
        self.elevationMeters = min(12_000, max(-500, elevationMeters))
        self.label = label
    }

    public static let madison = CosmicObserver(
        latitude: 43.0731,
        longitude: -89.4012,
        elevationMeters: 270,
        label: "Madison, Wisconsin"
    )
}

public struct HorizontalCoordinate: Sendable, Codable, Equatable {
    public let altitudeDegrees: Double
    public let azimuthDegrees: Double

    public init(altitudeDegrees: Double, azimuthDegrees: Double) {
        self.altitudeDegrees = altitudeDegrees
        self.azimuthDegrees = azimuthDegrees
    }
}

public struct AppleCosmicSnapshot: Sendable, Equatable {
    public let date: Date
    public let observer: CosmicObserver
    public let sun: HorizontalCoordinate
    public let moon: HorizontalCoordinate
    public let moonPhaseDegrees: Double
    public let moonIlluminatedFraction: Double
    public let galacticCenter: HorizontalCoordinate
    public let earthSurfaceSpeedKmPerSecond: Double
    public let earthSurfaceDistanceKm: Double
    public let earthSurfaceCMBModelDistanceKm: Double
}

public enum CosmicCalculationError: Error, Equatable {
    case invalidDate
    case ephemerisFailure(String)
}

public enum CosmicCalendarEngine {
    public static let earthAgeYears = 4.54e9
    public static let julianYearSeconds = 365.25 * 86_400.0
    public static let earthSiderealDaySeconds = 86_164.0905
    public static let earthOrbitalSpeedKmPerSecond = 29.78
    public static let sunGalacticSpeedKmPerSecond = 233.3
    public static let localGroupCMBSpeedKmPerSecond = 627.0
    public static let wgs84EquatorialRadiusKm = 6_378.137
    public static let wgs84EccentricitySquared = 6.69437999014e-3
    private static let distanceModelReference = Date(timeIntervalSince1970: 1_787_443_200) // 2026-08-23T00:00:00Z

    private static func astronomyTime(for date: Date) throws -> astro_time_t {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        let components = calendar.dateComponents([.year, .month, .day, .hour, .minute, .second, .nanosecond], from: date)
        guard
            let year = components.year,
            let month = components.month,
            let day = components.day,
            let hour = components.hour,
            let minute = components.minute,
            let wholeSecond = components.second
        else { throw CosmicCalculationError.invalidDate }
        let second = Double(wholeSecond) + Double(components.nanosecond ?? 0) / 1_000_000_000
        return Astronomy_MakeTime(Int32(year), Int32(month), Int32(day), Int32(hour), Int32(minute), second)
    }

    private static func horizontal(
        body: astro_body_t,
        time: inout astro_time_t,
        observer: astro_observer_t
    ) throws -> HorizontalCoordinate {
        let equatorial = Astronomy_Equator(body, &time, observer, EQUATOR_OF_DATE, ABERRATION)
        guard equatorial.status == ASTRO_SUCCESS else {
            throw CosmicCalculationError.ephemerisFailure("equatorial status \(equatorial.status.rawValue)")
        }
        let horizon = Astronomy_Horizon(&time, observer, equatorial.ra, equatorial.dec, REFRACTION_NORMAL)
        return HorizontalCoordinate(altitudeDegrees: horizon.altitude, azimuthDegrees: horizon.azimuth)
    }

    private static func galacticCenter(
        time: inout astro_time_t,
        observer: astro_observer_t
    ) -> HorizontalCoordinate {
        // Sagittarius A* in the ICRS/J2000 frame: 17h45m40.0409s, −29°00′28.118″.
        // For a widget-sized view the sub-arcsecond ICRS/FK5 distinction is immaterial.
        let raHours = 17.0 + 45.0 / 60.0 + 40.0409 / 3_600.0
        let declination = -(29.0 + 28.118 / 3_600.0)
        let horizon = Astronomy_Horizon(&time, observer, raHours, declination, REFRACTION_NORMAL)
        return HorizontalCoordinate(altitudeDegrees: horizon.altitude, azimuthDegrees: horizon.azimuth)
    }

    public static func earthParallelRadiusKm(latitudeDegrees: Double) -> Double {
        let latitude = latitudeDegrees * .pi / 180
        let primeVerticalRadius = wgs84EquatorialRadiusKm /
            sqrt(1 - wgs84EccentricitySquared * pow(sin(latitude), 2))
        return abs(primeVerticalRadius * cos(latitude))
    }

    public static func earthSurfaceRotationSpeedKmPerSecond(latitudeDegrees: Double) -> Double {
        2 * .pi * earthParallelRadiusKm(latitudeDegrees: latitudeDegrees) / earthSiderealDaySeconds
    }

    public static func snapshot(
        at date: Date = .now,
        observer cosmicObserver: CosmicObserver
    ) throws -> AppleCosmicSnapshot {
        var time = try astronomyTime(for: date)
        let observer = Astronomy_MakeObserver(
            cosmicObserver.latitude,
            cosmicObserver.longitude,
            cosmicObserver.elevationMeters
        )
        let sun = try horizontal(body: BODY_SUN, time: &time, observer: observer)
        let moon = try horizontal(body: BODY_MOON, time: &time, observer: observer)
        let moonPhase = Astronomy_MoonPhase(time)
        guard moonPhase.status == ASTRO_SUCCESS else {
            throw CosmicCalculationError.ephemerisFailure("moon phase status \(moonPhase.status.rawValue)")
        }
        let fraction = (1 - cos(moonPhase.angle * .pi / 180)) / 2
        let surfaceSpeed = earthSurfaceRotationSpeedKmPerSecond(latitudeDegrees: cosmicObserver.latitude)
        let elapsedModelYears = date.timeIntervalSince(distanceModelReference) / julianYearSeconds
        let dynamicEarthAgeYears = max(0, earthAgeYears + elapsedModelYears)
        let surfaceDistance = surfaceSpeed * dynamicEarthAgeYears * julianYearSeconds
        let cmbModelSpeed = surfaceSpeed + earthOrbitalSpeedKmPerSecond +
            sunGalacticSpeedKmPerSecond + localGroupCMBSpeedKmPerSecond

        return AppleCosmicSnapshot(
            date: date,
            observer: cosmicObserver,
            sun: sun,
            moon: moon,
            moonPhaseDegrees: moonPhase.angle,
            moonIlluminatedFraction: fraction,
            galacticCenter: galacticCenter(time: &time, observer: observer),
            earthSurfaceSpeedKmPerSecond: surfaceSpeed,
            earthSurfaceDistanceKm: surfaceDistance,
            earthSurfaceCMBModelDistanceKm: cmbModelSpeed * dynamicEarthAgeYears * julianYearSeconds
        )
    }
}

public enum CosmicDistanceFormatter {
    private static let lightYearKm = 9.4607304725808e12

    public static func string(kilometers: Double) -> String {
        let lightYears = kilometers / lightYearKm
        if abs(lightYears) >= 1_000_000_000 {
            return String(format: "%.3g billion ly", lightYears / 1_000_000_000)
        }
        if abs(lightYears) >= 1_000_000 {
            return String(format: "%.3g million ly", lightYears / 1_000_000)
        }
        if abs(lightYears) >= 1 {
            return String(format: "%.4g ly", lightYears)
        }
        return String(format: "%.4g km", kilometers)
    }
}
