import SwiftUI

extension TaskStatus {
    var color: Color {
        switch self {
        case .todo: return .gray
        case .inProgress: return .blue
        case .review: return .orange
        case .done: return .green
        }
    }
}

struct StatusBadge: View {
    let status: TaskStatus

    var body: some View {
        Text(status.rawValue)
            .font(.caption2.weight(.medium))
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(status.color.opacity(0.2))
            .foregroundStyle(status.color)
            .clipShape(Capsule())
    }
}
