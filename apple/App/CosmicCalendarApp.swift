import SwiftUI

@main
struct CosmicCalendarApp: App {
    @StateObject private var locationStore = CosmicLocationStore()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(locationStore)
                .preferredColorScheme(.dark)
        }
    }
}
