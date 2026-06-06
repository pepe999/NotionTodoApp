import SwiftUI

private struct IdentifiableDate: Identifiable {
    let date: Date
    var id: TimeInterval { date.timeIntervalSince1970 }
}

/// Měsíční kalendář (PLAN.md 5.6): mřížka 7 sloupců, tečky úkolů, tap = seznam dne,
/// long press = nový úkol s předvyplněným datem, swipe mezi měsíci.
struct CalendarView: View {
    @ObservedObject var store: TaskStore
    var onOpen: (TaskItem) -> Void
    var onCreate: (Date) -> Void

    @State private var month = Date()
    @State private var sheetDay: IdentifiableDate?

    private let columns = Array(repeating: GridItem(.flexible(), spacing: 2), count: 7)
    private let weekdays = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"]
    private var cal: Calendar {
        var c = Calendar.current
        c.firstWeekday = 2 // pondělí
        return c
    }

    var body: some View {
        VStack(spacing: 8) {
            header
            LazyVGrid(columns: columns, spacing: 4) {
                ForEach(weekdays, id: \.self) {
                    Text($0).font(.caption2).foregroundStyle(.secondary)
                }
                ForEach(gridDays(), id: \.self) { day in
                    dayCell(day)
                }
            }
            Spacer()
        }
        .padding()
        .gesture(
            DragGesture().onEnded { value in
                if value.translation.width < -50 { month = shift(1) }
                else if value.translation.width > 50 { month = shift(-1) }
            }
        )
        .sheet(item: $sheetDay) { wrapper in dayList(wrapper.date) }
    }

    private var header: some View {
        HStack {
            Button { month = shift(-1) } label: { Image(systemName: "chevron.left") }
            Spacer()
            Text(monthTitle).font(.headline)
            Spacer()
            Button { month = shift(1) } label: { Image(systemName: "chevron.right") }
        }
    }

    private func dayCell(_ day: Date) -> some View {
        let inMonth = cal.isDate(day, equalTo: month, toGranularity: .month)
        let dayTasks = store.tasks(onDay: day, calendar: cal)
        return VStack(spacing: 3) {
            Text("\(cal.component(.day, from: day))")
                .font(.callout)
                .foregroundStyle(inMonth ? .primary : .secondary)
                .frame(width: 28, height: 28)
                .background(cal.isDateInToday(day) ? Color.accentColor.opacity(0.2) : .clear)
                .clipShape(Circle())
            HStack(spacing: 2) {
                ForEach(dayTasks.prefix(3)) { Circle().fill($0.status.color).frame(width: 5, height: 5) }
            }
        }
        .frame(maxWidth: .infinity, minHeight: 48)
        .contentShape(Rectangle())
        .onTapGesture { if !dayTasks.isEmpty { sheetDay = IdentifiableDate(date: day) } }
        .onLongPressGesture { onCreate(day) }
    }

    private func dayList(_ day: Date) -> some View {
        NavigationStack {
            List(store.tasks(onDay: day, calendar: cal)) { task in
                Button {
                    sheetDay = nil
                    onOpen(task)
                } label: {
                    HStack { Text(task.name); Spacer(); StatusBadge(status: task.status) }
                }
            }
            .navigationTitle(DateUtils.isoDay(day))
        }
    }

    private func shift(_ months: Int) -> Date {
        cal.date(byAdding: .month, value: months, to: month) ?? month
    }

    private var monthTitle: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "LLLL yyyy"
        return formatter.string(from: month).capitalized
    }

    private func gridDays() -> [Date] {
        guard let monthInterval = cal.dateInterval(of: .month, for: month),
              let firstWeek = cal.dateInterval(of: .weekOfMonth, for: monthInterval.start)
        else { return [] }
        var days: [Date] = []
        var day = firstWeek.start
        for _ in 0..<42 {
            days.append(day)
            day = cal.date(byAdding: .day, value: 1, to: day) ?? day
        }
        return days
    }
}
