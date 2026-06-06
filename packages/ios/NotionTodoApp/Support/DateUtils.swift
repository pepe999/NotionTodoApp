import Foundation

/// Práce s Notion daty (PLAN.md 3.12 ekvivalent): date-only bez posunu o den.
enum DateUtils {
    static func parse(_ string: String) -> Date? {
        if string.count > 10 {
            return ISO8601DateFormatter().date(from: string)
        }
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.timeZone = .current
        return formatter.date(from: string)
    }

    static func format(_ string: String?) -> String {
        guard let string, let date = parse(string) else { return "" }
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        return formatter.string(from: date)
    }

    static func isoDay(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }

    static func isOverdue(_ string: String?, status: TaskStatus) -> Bool {
        guard status != .done, let string, let date = parse(string) else { return false }
        let cal = Calendar.current
        return cal.startOfDay(for: date) < cal.startOfDay(for: Date())
    }
}
