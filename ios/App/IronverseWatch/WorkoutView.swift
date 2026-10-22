// Ironverse Apple Watch — today's workout. Shows the current exercise, its
// sets (weight × reps), a big "Done set" button that logs the set on the
// iPhone, and a rest timer that taps your wrist when it's time to go again.

import SwiftUI

struct WorkoutView: View {
    @EnvironmentObject var phone: Phone
    @State private var exIndex = 0
    @State private var restEnds: Date?
    @State private var now = Date()
    private let tick = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    var body: some View {
        Group {
            if let w = phone.snapshot.workout, !w.exercises.isEmpty {
                session(w)
            } else {
                VStack(spacing: 6) {
                    Image(systemName: "dumbbell").font(.title2).foregroundColor(brand)
                    Text("No workout today").font(.headline)
                    Text("Start a session on your iPhone — it appears here to log sets from your wrist.").font(.caption2).foregroundColor(.secondary).multilineTextAlignment(.center)
                }
            }
        }
        .onReceive(tick) { t in
            now = t
            if let end = restEnds, t >= end {
                restEnds = nil
                Haptics.restOver()
            }
        }
    }

    @ViewBuilder
    private func session(_ w: WatchWorkout) -> some View {
        let i = min(exIndex, w.exercises.count - 1)
        let ex = w.exercises[i]
        let next = ex.sets.firstIndex { !$0.done }
        ScrollView {
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Button { exIndex = max(0, i - 1) } label: { Image(systemName: "chevron.left") }.buttonStyle(.plain).disabled(i == 0)
                    Spacer()
                    Text("\(i + 1)/\(w.exercises.count)").font(.caption2).foregroundColor(.secondary)
                    Spacer()
                    Button { exIndex = min(w.exercises.count - 1, i + 1) } label: { Image(systemName: "chevron.right") }.buttonStyle(.plain).disabled(i >= w.exercises.count - 1)
                }
                Text(ex.name).font(.headline).foregroundColor(brand).lineLimit(2)

                if let end = restEnds {
                    let left = max(0, Int(end.timeIntervalSince(now)))
                    VStack {
                        Text("Rest").font(.caption)
                        Text(String(format: "%d:%02d", left / 60, left % 60)).font(.system(size: 34, weight: .bold, design: .rounded))
                        Button("Skip rest") { restEnds = nil }.font(.caption)
                    }
                    .frame(maxWidth: .infinity)
                }

                ForEach(Array(ex.sets.enumerated()), id: \.offset) { idx, s in
                    HStack {
                        Text("Set \(idx + 1)").font(.caption)
                        Spacer()
                        Text(label(s)).font(.caption.bold())
                        Image(systemName: s.done ? "checkmark.circle.fill" : "circle").foregroundColor(s.done ? .green : .secondary)
                    }
                }

                if let n = next, w.logId != nil {
                    Button {
                        let s = ex.sets[n]
                        var fields: [String: Any] = ["logId": w.logId ?? "", "ex": ex.index, "set": n]
                        if let r = s.reps { fields["reps"] = r }
                        if let kg = s.kg { fields["kg"] = kg }
                        phone.send("setDone", fields)
                        Haptics.done()
                        restEnds = Date().addingTimeInterval(TimeInterval(ex.restSec))
                        if n == ex.sets.count - 1 && i < w.exercises.count - 1 { exIndex = i + 1 }
                    } label: {
                        Text("Done set \(n + 1)").bold().frame(maxWidth: .infinity)
                    }
                    .tint(brand)
                } else if w.logId == nil {
                    Text("Tap Start on your iPhone to log sets here.").font(.caption2).foregroundColor(.secondary)
                } else {
                    Text("Exercise complete ✓").font(.caption).foregroundColor(.green)
                }
            }
        }
    }

    private func label(_ s: WatchSet) -> String {
        let reps = s.reps.map { "\($0)" } ?? "–"
        if let kg = s.kg, kg > 0 { return "\(kg.formatted(.number.precision(.fractionLength(0...1)))) kg × \(reps)" }
        return "\(reps) reps"
    }
}
