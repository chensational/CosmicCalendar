// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "CosmicCalendarApple",
    platforms: [.macOS(.v14), .iOS(.v17), .watchOS(.v10), .visionOS(.v1)],
    products: [
        .library(name: "CosmicCalendarCore", targets: ["CosmicCalendarCore"]),
        .executable(name: "CosmicCalendarCoreVerifier", targets: ["CosmicCalendarCoreVerifier"]),
    ],
    targets: [
        .target(
            name: "CAstronomyEngine",
            path: "Sources/CAstronomyEngine",
            publicHeadersPath: "include",
            cSettings: [.unsafeFlags(["-std=c11"])]
        ),
        .target(
            name: "CosmicCalendarCore",
            dependencies: ["CAstronomyEngine"],
            path: "Sources/CosmicCalendarCore"
        ),
        .executableTarget(
            name: "CosmicCalendarCoreVerifier",
            dependencies: ["CosmicCalendarCore"],
            path: "Sources/CosmicCalendarCoreVerifier"
        ),
    ]
)
