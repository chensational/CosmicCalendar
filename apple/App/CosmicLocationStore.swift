import CoreLocation
import CosmicCalendarCore
import Foundation

@MainActor
final class CosmicLocationStore: NSObject, ObservableObject, CLLocationManagerDelegate {
    static let appGroup = "group.com.chensational.cosmiccalendar"
    private let manager = CLLocationManager()
    private let defaults = UserDefaults(suiteName: appGroup) ?? .standard

    @Published private(set) var observer: CosmicObserver
    @Published private(set) var authorization: CLAuthorizationStatus
    @Published private(set) var errorMessage: String?

    override init() {
        let latitude = defaults.object(forKey: "observer.latitude") as? Double ?? CosmicObserver.madison.latitude
        let longitude = defaults.object(forKey: "observer.longitude") as? Double ?? CosmicObserver.madison.longitude
        let elevation = defaults.object(forKey: "observer.elevation") as? Double ?? CosmicObserver.madison.elevationMeters
        observer = CosmicObserver(latitude: latitude, longitude: longitude, elevationMeters: elevation, label: defaults.string(forKey: "observer.label") ?? "Saved location")
        authorization = manager.authorizationStatus
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyKilometer
    }

    nonisolated private static func isAuthorized(_ status: CLAuthorizationStatus) -> Bool {
        #if os(macOS)
        return status == .authorizedAlways
        #else
        return status == .authorizedAlways || status == .authorizedWhenInUse
        #endif
    }

    func requestLocation() {
        errorMessage = nil
        let status = manager.authorizationStatus
        if status == .notDetermined {
            manager.requestWhenInUseAuthorization()
        } else if Self.isAuthorized(status) {
            manager.requestLocation()
        } else if status == .denied || status == .restricted {
            errorMessage = "Location access is off. Enable it in Settings or keep the saved location."
        } else {
            errorMessage = "Location status is unavailable."
        }
    }

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let status = manager.authorizationStatus
        Task { @MainActor [weak self] in
            guard let self else { return }
            authorization = status
            if Self.isAuthorized(status) {
                self.manager.requestLocation()
            }
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }
        let latitude = location.coordinate.latitude
        let longitude = location.coordinate.longitude
        let elevation = max(0, location.altitude)
        Task { @MainActor [weak self] in
            guard let self else { return }
            observer = CosmicObserver(
                latitude: latitude,
                longitude: longitude,
                elevationMeters: elevation,
                label: "Your location"
            )
            defaults.set(observer.latitude, forKey: "observer.latitude")
            defaults.set(observer.longitude, forKey: "observer.longitude")
            defaults.set(observer.elevationMeters, forKey: "observer.elevation")
            defaults.set(observer.label, forKey: "observer.label")
            defaults.set(Date().timeIntervalSince1970, forKey: "observer.updatedAt")
            #if canImport(WidgetKit)
            WidgetCenter.shared.reloadTimelines(ofKind: "CosmicCalendarWidget")
            #endif
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        let message = error.localizedDescription
        Task { @MainActor [weak self] in
            self?.errorMessage = message
        }
    }
}

#if canImport(WidgetKit)
import WidgetKit
#endif
