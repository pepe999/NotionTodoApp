import SwiftUI

/// Karta úkolu (PLAN.md 5.4): min. výška 80pt, badge podúkolů, due (červené po termínu).
struct TaskCardView: View {
    let task: TaskItem
    let subtaskCount: Int

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(task.name)
                .font(.subheadline.weight(.medium))
                .lineLimit(2)

            if !task.tags.isEmpty {
                HStack(spacing: 4) {
                    ForEach(task.tags.prefix(3), id: \.self) { tag in
                        Text(tag)
                            .font(.caption2)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.secondary.opacity(0.15))
                            .clipShape(Capsule())
                    }
                }
            }

            HStack(spacing: 12) {
                if let due = task.dueDate {
                    Label(DateUtils.format(due), systemImage: "calendar")
                        .font(.caption2)
                        .foregroundStyle(DateUtils.isOverdue(due, status: task.status) ? .red : .secondary)
                }
                if subtaskCount > 0 {
                    Label("\(subtaskCount)", systemImage: "checklist")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                Spacer()
            }
        }
        .padding(12)
        .frame(minHeight: 80, alignment: .topLeading)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}
