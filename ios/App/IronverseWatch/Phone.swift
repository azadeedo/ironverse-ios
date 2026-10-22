// Ironverse Apple Watch — link to the iPhone app (WatchConnectivity).
//
// The iPhone sends a small JSON snapshot as the application context
// ({"json": "..."}): today's calories, protein, water, creatine, steps,
// recovery and today's workout. The Watch sends actions (water, creatine,
// set done). Every action gets an id and stays in a queue (saved on the
// Watch) until the iPhone replies {"ok": true, "id": ...}, so nothing logged
// on the wrist is lost if the phone is out of reach.

import Foundation
import WatchConnectivity
import WatchKit

struct WatchSet: Codable, Hashable {
    var reps: Int?
    var kg: Double?
    var done: Bool
}

struct WatchExercise: Codable, Hashable, Identifiable {
    var id: Int { index }
    var index: Int
    var name: String
    var restSec: Int
    var sets: [WatchSet]
}

struct WatchWorkout: Codable, Hashable {
    var logId: String?
    var title: String
    var exercises: [WatchExercise]
}

struct Snapshot: Codable {
    var updatedAt: String
    var name: String?
    var kcalLeft: Int
    var kcalTarget: Int
    var protein: Int
    var proteinTarget: Int
    var waterMl: Int
    var waterTargetMl: Int
    var creatineTaken: Bool
    var creatineGrams: Double?
    var steps: Int?
    var recovery: Int?
    var recoveryZone: String?
    var workout: WatchWorkout?

    static let empty = Snapshot(updatedAt: "", name: nil, kcalLeft: 0, kcalTarget: 0, protein: 0, proteinTarget: 0,
                                waterMl: 0, waterTargetMl: 0, creatineTaken: false, creatineGrams: nil, steps: nil,
                                recovery: nil, recoveryZone: nil, workout: nil)
}

final class Phone: NSObject, ObservableObject, WCSessionDelegate {
    static let shared = Phone()

    @Published var snapshot: Snapshot = .empty
    @Published var reachable = false
    @Published var pending = 0

    private let queueKey = "iv.pendingActions"
    private let snapKey = "iv.lastSnapshot"
    private var queue: [[String: Any]] = []

    override init() {
        super.init()
        if let saved = UserDefaults.standard.array(forKey: queueKey) as? [[String: Any]] { queue = saved }
        pending = queue.count
        if let data = UserDefaults.standard.data(forKey: snapKey), let s = try? JSONDecoder().decode(Snapshot.self, from: data) { snapshot = s }
        if WCSession.isSupported() {
            WCSession.default.delegate = self
            WCSession.default.activate()
        }
    }

    // MARK: actions from the wrist

    func send(_ type: String, _ fields: [String: Any] = [:]) {
        var action = fields
        action["type"] = type
        action["id"] = UUID().uuidString
        action["at"] = ISO8601DateFormatter().string(from: Date())
        queue.append(action)
        save()
        applyLocally(action)
        flush()
    }

    /// optimistic update so the wrist shows the change straight away
    private func applyLocally(_ a: [String: Any]) {
        switch a["type"] as? String {
        case "water":
            snapshot.waterMl += (a["ml"] as? Int) ?? 0
        case "creatine":
            snapshot.creatineTaken = true
        case "setDone":
            if let ex = a["ex"] as? Int, let set = a["set"] as? Int, var w = snapshot.workout,
               ex < w.exercises.count, set < w.exercises[ex].sets.count {
                w.exercises[ex].sets[set].done = true
                if let reps = a["reps"] as? Int { w.exercises[ex].sets[set].reps = reps }
                if let kg = a["kg"] as? Double { w.exercises[ex].sets[set].kg = kg }
                snapshot.workout = w
            }
        default: break
        }
    }

    func flush() {
        guard WCSession.default.activationState == .activated, WCSession.default.isReachable else { return }
        for action in queue {
            WCSession.default.sendMessage(action, replyHandler: { [weak self] reply in
                guard let id = reply["id"] as? String, (reply["ok"] as? Bool) == true else { return }
                DispatchQueue.main.async { self?.acknowledge(id) }
            }, errorHandler: nil)
        }
    }

    private func acknowledge(_ id: String) {
        queue.removeAll { ($0["id"] as? String) == id }
        save()
    }

    private func save() {
        UserDefaults.standard.set(queue, forKey: queueKey)
        DispatchQueue.main.async { self.pending = self.queue.count }
    }

    // MARK: snapshot from the iPhone

    private func take(_ context: [String: Any]) {
        guard let json = context["json"] as? String, let data = json.data(using: .utf8),
              let s = try? JSONDecoder().decode(Snapshot.self, from: data) else { return }
        UserDefaults.standard.set(data, forKey: snapKey)
        DispatchQueue.main.async {
            self.snapshot = s
            // re-apply anything the phone hasn't confirmed yet
            for a in self.queue { self.applyLocally(a) }
        }
    }

    // MARK: WCSessionDelegate

    func session(_ session: WCSession, activationDidCompleteWith state: WCSessionActivationState, error: Error?) {
        take(session.receivedApplicationContext)
        DispatchQueue.main.async { self.reachable = session.isReachable }
        flush()
    }

    func sessionReachabilityDidChange(_ session: WCSession) {
        DispatchQueue.main.async { self.reachable = session.isReachable }
        flush()
    }

    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        take(applicationContext)
        flush()
    }

    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        if message["json"] != nil { take(message) }
    }
}

enum Haptics {
    static func tap() { WKInterfaceDevice.current().play(.click) }
    static func done() { WKInterfaceDevice.current().play(.success) }
    static func restOver() { WKInterfaceDevice.current().play(.notification) }
}
