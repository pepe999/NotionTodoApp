import SwiftUI

/// Gantt / časová osa přes Canvas (PLAN.md 5.5): bary podle Timeline/Due, dnešní
/// linka, pinch-to-zoom (šířka dne). Tap na bar (overlay) otevře detail.
struct TimelineView: View {
    @ObservedObject var store: TaskStore
    var onOpen: (TaskItem) -> Void

    @State private var dayWidth: CGFloat = 28
    private let rowHeight: CGFloat = 36

    private struct Bar: Identifiable {
        let task: TaskItem
        let start: Date
        let end: Date
        var id: String { task.id }
    }

    var body: some View {
        let bars = computeBars()
        if bars.isEmpty {
            Text("Žádné úkoly s termínem nebo časovým rozpětím.")
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            let range = dateRange(bars)
            let totalDays = max(1, days(from: range.start, to: range.end) + 1)
            let width = CGFloat(totalDays) * dayWidth
            let height = CGFloat(bars.count) * rowHeight + rowHeight

            ScrollView([.horizontal, .vertical]) {
                ZStack(alignment: .topLeading) {
                    Canvas { context, _ in
                        drawGrid(context: context, totalDays: totalDays, height: height, start: range.start)
                        for (index, bar) in bars.enumerated() {
                            drawBar(context: context, bar: bar, index: index, rangeStart: range.start)
                        }
                    }
                    .frame(width: width, height: height)

                    // Overlay průhledných tlačítek pro tap na bar.
                    ForEach(Array(bars.enumerated()), id: \.element.id) { index, bar in
                        let x = CGFloat(days(from: range.start, to: bar.start)) * dayWidth
                        let w = CGFloat(days(from: bar.start, to: bar.end) + 1) * dayWidth
                        Button { onOpen(bar.task) } label: { Color.clear }
                            .frame(width: max(w, dayWidth), height: rowHeight - 8)
                            .offset(x: x, y: rowHeight + CGFloat(index) * rowHeight + 4)
                    }
                }
            }
            .gesture(
                MagnificationGesture().onChanged { scale in
                    dayWidth = min(80, max(12, 28 * scale))
                }
            )
        }
    }

    // MARK: - Kreslení

    private func drawGrid(context: GraphicsContext, totalDays: Int, height: CGFloat, start: Date) {
        for i in 0...totalDays {
            let x = CGFloat(i) * dayWidth
            var line = Path()
            line.move(to: CGPoint(x: x, y: 0))
            line.addLine(to: CGPoint(x: x, y: height))
            context.stroke(line, with: .color(.gray.opacity(0.12)), lineWidth: 1)
        }
        let todayX = CGFloat(days(from: start, to: Date())) * dayWidth + dayWidth / 2
        var today = Path()
        today.move(to: CGPoint(x: todayX, y: 0))
        today.addLine(to: CGPoint(x: todayX, y: height))
        context.stroke(today, with: .color(.red), lineWidth: 1.5)
    }

    private func drawBar(context: GraphicsContext, bar: Bar, index: Int, rangeStart: Date) {
        let x = CGFloat(days(from: rangeStart, to: bar.start)) * dayWidth
        let w = CGFloat(days(from: bar.start, to: bar.end) + 1) * dayWidth
        let y = rowHeight + CGFloat(index) * rowHeight + 4
        let rect = CGRect(x: x + 2, y: y, width: max(w - 4, dayWidth - 4), height: rowHeight - 8)
        let path = Path(roundedRect: rect, cornerRadius: 6)
        context.fill(path, with: .color(bar.task.status.color))
        context.draw(
            Text(bar.task.name).font(.caption2).foregroundColor(.white),
            at: CGPoint(x: rect.minX + 6, y: rect.midY),
            anchor: .leading
        )
    }

    // MARK: - Výpočty

    private func computeBars() -> [Bar] {
        store.tasks.compactMap { task -> Bar? in
            guard task.parentId == nil else { return nil }
            if let tl = task.timeline, let s = DateUtils.parse(tl.start), let e = DateUtils.parse(tl.end) {
                return Bar(task: task, start: s, end: e)
            }
            if let due = task.dueDate, let d = DateUtils.parse(due) {
                return Bar(task: task, start: d, end: d)
            }
            return nil
        }
    }

    private func dateRange(_ bars: [Bar]) -> (start: Date, end: Date) {
        let cal = Calendar.current
        let dates = bars.flatMap { [$0.start, $0.end] } + [Date()]
        let start = cal.startOfDay(for: dates.min() ?? Date())
        let end = cal.date(byAdding: .day, value: 7, to: dates.max() ?? Date()) ?? Date()
        return (start, end)
    }

    private func days(from: Date, to: Date) -> Int {
        Calendar.current.dateComponents([.day], from: Calendar.current.startOfDay(for: from),
                                        to: Calendar.current.startOfDay(for: to)).day ?? 0
    }
}
