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

    func requestLocation() {
        errorMessage = nil
        switch manager.authorizationStatus {
        case .notDetermined:
            manager.requestWhenInUseAuthorization()
        case .authorizedAlways, .authorizedWhenInUse:
            manager.requestLocation()
        case .denied, .restricted:
            errorMessage = "Location access is off. Enable it in Settings or keep the saved location."
        @unknown default:
            errorMessage = "Location status is unavailable."
        }
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        authorization = manager.authorizationStatus
        if authorization == .authorizedAlways || authorization == .authorizedWhenInUse {
            manager.requestLocation()
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }
        observer = CosmicObserver(
            latitude: location.coordinate.latitude,
            longitude: location.coordinate.longitude,
            elevationMeters: max(0, location.altitude),
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

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        errorMessage = error.localizedDescription
    }
}

#if canImport(WidgetKit)
import WidgetKit
#endif
