import SwiftUI

/// Kanban (PLAN.md 5.4): horizontální sloupce, tap → detail, contextMenu pro
/// rychlou změnu statusu, pull-to-refresh (řeší DashboardView), empty state.
struct KanbanView: View {
    @ObservedObject var store: TaskStore
    var onOpen: (TaskItem) -> Void
    var onCreate: () -> Void

    var body: some View {
        if !store.tasks.contains(where: { $0.parentId == nil }) {
            VStack(spacing: 16) {
                Text("Zatím žádné úkoly").foregroundStyle(.secondary)
                Button("Vytvořit první úkol", action: onCreate)
                    .buttonStyle(.borderedProminent)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            ScrollView(.horizontal, showsIndicators: false) {
                LazyHStack(alignment: .top, spacing: 12) {
                    ForEach(TaskStatus.allCases) { column($0) }
                }
                .padding()
            }
        }
    }

    private func column(_ status: TaskStatus) -> some View {
        let items = store.topLevel(status: status)
        return VStack(alignment: .leading, spacing: 8) {
            HStack {
                Circle().fill(status.color).frame(width: 10, height: 10)
                Text(status.rawValue).font(.headline)
                Text("\(items.count)").foregroundStyle(.secondary)
                Spacer()
            }
            ScrollView(showsIndicators: false) {
                LazyVStack(spacing: 8) {
                    ForEach(items) { task in
                        TaskCardView(task: task, subtaskCount: store.subtaskCount(task.id))
                            .onTapGesture { onOpen(task) }
                            .contextMenu { statusMenu(for: task) }
                    }
                }
            }
        }
        .frame(width: 280)
    }

    @ViewBuilder private func statusMenu(for task: TaskItem) -> some View {
        ForEach(TaskStatus.allCases) { status in
            Button {
                Task { await store.update(id: task.id, .init(status: status)) }
            } label: {
                Label(status.rawValue, systemImage: task.status == status ? "checkmark" : "")
            }
        }
    }
}
