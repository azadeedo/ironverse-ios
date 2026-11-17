// On-device text reading with Apple's Vision framework (17 Nov 2026).
// Used for nutrition labels (Ironverse) and invoices (Routeverse). The photo never leaves the iPhone.
// The web layer calls Capacitor.Plugins.TextReader.read({ image: <base64 JPEG> }) and gets back the
// text as lines, top to bottom, each line's words left to right (the same shape the web OCR returns),
// so the existing label/invoice parsers work unchanged.

import UIKit
import Capacitor
import Vision

@objc(TextReaderPlugin)
public class TextReaderPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "TextReaderPlugin"
    public let jsName = "TextReader"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "read", returnType: CAPPluginReturnPromise)
    ]

    @objc func read(_ call: CAPPluginCall) {
        guard let b64 = call.getString("image") else { call.reject("No image"); return }
        let clean = b64.components(separatedBy: ",").last ?? b64
        guard let data = Data(base64Encoded: clean, options: .ignoreUnknownCharacters),
              let image = UIImage(data: data), let cg = image.cgImage else {
            call.reject("That photo could not be read"); return
        }
        DispatchQueue.global(qos: .userInitiated).async {
            let request = VNRecognizeTextRequest()
            request.recognitionLevel = .accurate
            // numbers matter more than words here: no autocorrect turning "0.7g" into a word
            request.usesLanguageCorrection = false
            request.recognitionLanguages = ["en-US"]
            let handler = VNImageRequestHandler(cgImage: cg, orientation: TextReaderPlugin.orientation(image.imageOrientation), options: [:])
            do {
                try handler.perform([request])
            } catch {
                call.reject("Text reading failed"); return
            }
            let obs = (request.results ?? []).compactMap { o -> (String, CGRect)? in
                guard let s = o.topCandidates(1).first?.string else { return nil }
                return (s, o.boundingBox)
            }
            call.resolve(["text": TextReaderPlugin.lines(obs).joined(separator: "\n")])
        }
    }

    /// Group words into rows by their vertical centre (Vision's y runs bottom to top), left to right in a row.
    static func lines(_ obs: [(String, CGRect)]) -> [String] {
        let sorted = obs.sorted { $0.1.midY > $1.1.midY }
        var rows: [[(String, CGRect)]] = []
        for o in sorted {
            if let last = rows.last, let first = last.first {
                let h = max(first.1.height, o.1.height)
                let rowMid = last.map { $0.1.midY }.reduce(0, +) / CGFloat(last.count)
                if abs(o.1.midY - rowMid) < h * 0.5 {
                    rows[rows.count - 1].append(o)
                    continue
                }
            }
            rows.append([o])
        }
        return rows.map { $0.sorted { $0.1.minX < $1.1.minX }.map { $0.0 }.joined(separator: " ") }
    }

    static func orientation(_ o: UIImage.Orientation) -> CGImagePropertyOrientation {
        switch o {
        case .up: return .up
        case .down: return .down
        case .left: return .left
        case .right: return .right
        case .upMirrored: return .upMirrored
        case .downMirrored: return .downMirrored
        case .leftMirrored: return .leftMirrored
        case .rightMirrored: return .rightMirrored
        @unknown default: return .up
        }
    }
}

/// The app's web view controller: Capacitor's own, plus the TextReader plugin.
class AppViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(TextReaderPlugin())
    }
}
