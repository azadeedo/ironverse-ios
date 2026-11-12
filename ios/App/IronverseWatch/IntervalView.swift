// Ironverse Apple Watch interval timer (HIIT, Tabata, circuits): work and rest
// times and a number of rounds, with a buzz at every switch. Works on the watch alone.

import SwiftUI

struct IntervalView: View {
    @State private var work = 40
    @State private var rest = 20
    @State private var rounds = 8
    @State private var startedAt: Date?

    var body: some View {
        if let start = startedAt {
            TimelineView(.periodic(from: .now, by: 0.5)) { ctx in
                let total = Double(work + rest)
                let t = ctx.date.timeIntervalSince(start)
                let round = min(rounds, Int(t / total) + 1)
                let inRound = t - Double(round - 1) * total
                let isWork = inRound < Double(work)
                let left = max(0, Int((isWork ? Double(work) - inRound : total - inRound).rounded(.up)))
                let finished = t >= total * Double(rounds) - Double(rest)
                VStack(spacing: 4) {
                    Text(finished ? "Done!" : isWork ? "WORK" : "REST")
                        .font(.headline).foregroundColor(finished ? .green : isWork ? brand : .cyan)
                    Text(finished ? "✓" : "\(left)").font(.system(size: 44, weight: .bold, design: .rounded)).monospacedDigit()
                    Text("Round \(round) of \(rounds)").font(.caption2).foregroundColor(.secondary)
                    Button(finished ? "Close" : "Stop") { startedAt = nil }.tint(finished ? .green : .red)
                }
                .onChange(of: finished ? -1 : (isWork ? round * 2 : round * 2 + 1)) { _, v in
                    if v == -1 { Haptics.done() } else { Haptics.restOver() }
                }
            }
        } else {
            ScrollView {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Intervals").font(.headline).foregroundColor(brand)
                    Stepper("Work \(work)s", value: $work, in: 5...300, step: 5)
                    Stepper("Rest \(rest)s", value: $rest, in: 5...300, step: 5)
                    Stepper("\(rounds) rounds", value: $rounds, in: 1...30)
                    HStack {
                        Button("Tabata") { work = 20; rest = 10; rounds = 8 }.font(.caption2).buttonStyle(.bordered)
                        Button("EMOM") { work = 45; rest = 15; rounds = 10 }.font(.caption2).buttonStyle(.bordered)
                    }
                    Button { Haptics.tap(); startedAt = Date() } label: { Label("Start", systemImage: "play.fill") }.tint(brand)
                }
                .padding(.horizontal, 4)
            }
        }
    }
}
