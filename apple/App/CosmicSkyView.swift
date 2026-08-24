import CosmicCalendarCore
import SwiftUI

struct CosmicSkyView: View {
    let snapshot: AppleCosmicSnapshot

    private func point(_ coordinate: HorizontalCoordinate, size: CGSize) -> CGPoint {
        CGPoint(
            x: coordinate.azimuthDegrees / 360 * size.width,
            y: size.height * 0.72 - coordinate.altitudeDegrees / 90 * size.height * 0.58
        )
    }

    var body: some View {
        Canvas { context, size in
            let sky = Gradient(colors: [Color(red: 0.04, green: 0.09, blue: 0.18), .black])
            context.fill(Path(CGRect(origin: .zero, size: size)), with: .linearGradient(sky, startPoint: .zero, endPoint: CGPoint(x: 0, y: size.height)))
            let horizon = Path { path in
                path.move(to: CGPoint(x: 0, y: size.height * 0.72))
                path.addCurve(
                    to: CGPoint(x: size.width, y: size.height * 0.72),
                    control1: CGPoint(x: size.width * 0.25, y: size.height * 0.67),
                    control2: CGPoint(x: size.width * 0.75, y: size.height * 0.77)
                )
                path.addLine(to: CGPoint(x: size.width, y: size.height))
                path.addLine(to: CGPoint(x: 0, y: size.height))
                path.closeSubpath()
            }
            context.fill(horizon, with: .color(Color(red: 0.025, green: 0.04, blue: 0.08)))

            let sun = point(snapshot.sun, size: size)
            context.fill(Path(ellipseIn: CGRect(x: sun.x - 10, y: sun.y - 10, width: 20, height: 20)), with: .color(.yellow))
            let moon = point(snapshot.moon, size: size)
            context.fill(Path(ellipseIn: CGRect(x: moon.x - 7, y: moon.y - 7, width: 14, height: 14)), with: .color(.white.opacity(0.9)))
            let core = point(snapshot.galacticCenter, size: size)
            context.fill(Path(ellipseIn: CGRect(x: core.x - 3, y: core.y - 3, width: 6, height: 6)), with: .color(.purple.opacity(0.9)))
        }
        .accessibilityLabel("Sky from \(snapshot.observer.label). Sun altitude \(snapshot.sun.altitudeDegrees, specifier: "%.1f") degrees. Moon altitude \(snapshot.moon.altitudeDegrees, specifier: "%.1f") degrees.")
    }
}
