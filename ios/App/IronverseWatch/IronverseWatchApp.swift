// Ironverse Apple Watch app — entry point. Three swipeable pages:
// Today (calories, protein, water, recovery), Workout (log sets + rest timer)
// and Quick log (water, creatine).

import SwiftUI

@main
struct IronverseWatchApp: App {
    @StateObject private var phone = Phone.shared
    // `-ivPage N` opens on page N (App Store screenshots); 0 otherwise
    @State private var page = UserDefaults.standard.integer(forKey: "ivPage")

    var body: some Scene {
        WindowGroup {
            TabView(selection: $page) {
                TodayView().tag(0)
                WorkoutView().tag(1)
                QuickLogView().tag(2)
            }
            .tabViewStyle(.verticalPage)
            .environmentObject(phone)
        }
    }
}

let brand = Color(red: 0.96, green: 0.62, blue: 0.04)

struct TodayView: View {
    @EnvironmentObject var phone: Phone

    var body: some View {
        let s = phone.snapshot
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("Today").font(.headline).foregroundColor(brand)
                    Spacer()
                    if phone.pending > 0 { Image(systemName: "arrow.triangle.2.circlepath").foregroundColor(.orange) }
                }
                if s.updatedAt.isEmpty {
                    Text("Open Ironverse on your iPhone once to sync.").font(.footnote).foregroundColor(.secondary)
                } else {
                    Ring(label: "kcal left", value: "\(max(0, s.kcalLeft))", progress: s.kcalTarget > 0 ? Double(s.kcalTarget - s.kcalLeft) / Double(s.kcalTarget) : 0, color: brand)
                    Bar(label: "Protein", value: "\(s.protein) / \(s.proteinTarget) g", progress: s.proteinTarget > 0 ? Double(s.protein) / Double(s.proteinTarget) : 0, color: .green)
                    Bar(label: "Water", value: String(format: "%.1f / %.1f L", Double(s.waterMl) / 1000, Double(s.waterTargetMl) / 1000), progress: s.waterTargetMl > 0 ? Double(s.waterMl) / Double(s.waterTargetMl) : 0, color: .cyan)
                    if let r = s.recovery {
                        HStack {
                            Text("Recovery").font(.caption)
                            Spacer()
                            Text("\(r)").font(.title3.bold()).foregroundColor(s.recoveryZone == "green" ? .green : s.recoveryZone == "amber" ? .orange : .red)
                        }
                    }
                    if let st = s.steps { HStack { Text("Steps").font(.caption); Spacer(); Text("\(st)").font(.caption.bold()) } }
                    Text(s.creatineTaken ? "Creatine ✓" : "Creatine not yet").font(.caption2).foregroundColor(s.creatineTaken ? .green : .secondary)
                }
            }
            .padding(.horizontal, 4)
        }
    }
}

struct Ring: View {
    let label: String
    let value: String
    let progress: Double
    let color: Color

    var body: some View {
        HStack {
            ZStack {
                Circle().stroke(color.opacity(0.25), lineWidth: 6)
                Circle().trim(from: 0, to: min(1, max(0, progress))).stroke(color, style: StrokeStyle(lineWidth: 6, lineCap: .round)).rotationEffect(.degrees(-90))
            }
            .frame(width: 44, height: 44)
            VStack(alignment: .leading) {
                Text(value).font(.title3.bold())
                Text(label).font(.caption2).foregroundColor(.secondary)
            }
        }
    }
}

struct Bar: View {
    let label: String
    let value: String
    let progress: Double
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack { Text(label).font(.caption); Spacer(); Text(value).font(.caption2) }
            GeometryReader { g in
                ZStack(alignment: .leading) {
                    Capsule().fill(color.opacity(0.25))
                    Capsule().fill(color).frame(width: g.size.width * min(1, max(0, progress)))
                }
            }
            .frame(height: 5)
        }
    }
}

struct QuickLogView: View {
    @EnvironmentObject var phone: Phone

    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                Text("Quick log").font(.headline).foregroundColor(brand)
                HStack {
                    Button("+250 ml") { phone.send("water", ["ml": 250]); Haptics.done() }
                    Button("+500 ml") { phone.send("water", ["ml": 500]); Haptics.done() }
                }
                .tint(.cyan)
                Button(phone.snapshot.creatineTaken ? "Creatine ✓" : "Took creatine") {
                    phone.send("creatine"); Haptics.done()
                }
                .tint(.green)
                .disabled(phone.snapshot.creatineTaken)
                Text(phone.reachable ? "Connected to iPhone" : "Saved — syncs when your iPhone is near")
                    .font(.caption2).foregroundColor(.secondary).multilineTextAlignment(.center)
            }
        }
    }
}
