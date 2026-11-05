// Ironverse Apple Watch tools that work on the watch alone: a rest timer,
// a plate calculator and a one-rep-max estimate (Digital Crown to adjust).

import SwiftUI

struct RestTimerView: View {
    @State private var length = 90
    @State private var endsAt: Date?

    var body: some View {
        VStack(spacing: 6) {
            Text("Rest timer").font(.headline).foregroundColor(brand)
            if let end = endsAt {
                TimelineView(.periodic(from: .now, by: 1)) { ctx in
                    let left = max(0, Int(end.timeIntervalSince(ctx.date).rounded(.up)))
                    VStack(spacing: 4) {
                        ZStack {
                            Circle().stroke(Color.white.opacity(0.12), lineWidth: 7)
                            Circle().trim(from: 0, to: CGFloat(left) / CGFloat(max(length, 1)))
                                .stroke(brand, style: StrokeStyle(lineWidth: 7, lineCap: .round)).rotationEffect(.degrees(-90))
                            Text(String(format: "%d:%02d", left / 60, left % 60)).font(.title2.monospacedDigit().bold())
                        }
                        .frame(width: 96, height: 96)
                        .onChange(of: left) { _, v in if v == 0 { Haptics.restOver(); endsAt = nil } }
                        Button("Stop") { endsAt = nil }.tint(.red)
                    }
                }
            } else {
                Text("\(length / 60):\(String(format: "%02d", length % 60))").font(.title.monospacedDigit().bold())
                    .focusable().digitalCrownRotation(Binding(get: { Double(length) }, set: { length = Int($0 / 15) * 15 }),
                                                      from: 30, through: 300, by: 15, sensitivity: .medium)
                HStack {
                    ForEach([60, 90, 120, 180], id: \.self) { s in
                        Button("\(s)") { length = s }.font(.caption2).buttonStyle(.bordered)
                    }
                }
                Button { Haptics.tap(); endsAt = Date().addingTimeInterval(TimeInterval(length)) } label: {
                    Label("Start", systemImage: "timer")
                }.tint(brand)
            }
        }
        .padding(.horizontal, 4)
    }
}

struct PlatesView: View {
    @State private var target = 100.0
    @State private var bar = 20.0
    private let plates = [25.0, 20.0, 15.0, 10.0, 5.0, 2.5, 1.25]

    private var perSide: [Double] {
        var left = max(0, (target - bar) / 2), out: [Double] = []
        for p in plates { while left + 0.001 >= p { out.append(p); left -= p } }
        return out
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 6) {
                Text("Plates").font(.headline).foregroundColor(brand)
                Text(String(format: "%g kg", target)).font(.title2.bold()).frame(maxWidth: .infinity)
                    .focusable().digitalCrownRotation($target, from: 20, through: 320, by: 2.5, sensitivity: .medium)
                Picker("Bar", selection: $bar) {
                    Text("20 kg bar").tag(20.0)
                    Text("15 kg bar").tag(15.0)
                    Text("10 kg bar").tag(10.0)
                }.frame(height: 44)
                Text("Each side").font(.caption2).foregroundColor(.secondary)
                if perSide.isEmpty {
                    Text("Just the bar").font(.footnote)
                } else {
                    Text(perSide.map { String(format: "%g", $0) }.joined(separator: " + ")).font(.footnote.bold())
                }
            }
            .padding(.horizontal, 4)
        }
    }
}

struct OneRepMaxView: View {
    @State private var kg = 80.0
    @State private var reps = 5

    var body: some View {
        let oneRm = reps <= 1 ? kg : kg * (1 + Double(reps) / 30)
        ScrollView {
            VStack(alignment: .leading, spacing: 6) {
                Text("1-rep max").font(.headline).foregroundColor(brand)
                Text(String(format: "%g kg", kg)).font(.title3.bold()).frame(maxWidth: .infinity)
                    .focusable().digitalCrownRotation($kg, from: 5, through: 400, by: 2.5, sensitivity: .medium)
                Stepper("\(reps) reps", value: $reps, in: 1...15)
                HStack {
                    Text("Estimate").font(.caption)
                    Spacer()
                    Text(String(format: "%.1f kg", oneRm)).font(.headline).foregroundColor(brand)
                }
                Text(String(format: "90%%: %.1f · 80%%: %.1f · 70%%: %.1f", oneRm * 0.9, oneRm * 0.8, oneRm * 0.7))
                    .font(.caption2).foregroundColor(.secondary)
            }
            .padding(.horizontal, 4)
        }
    }
}
