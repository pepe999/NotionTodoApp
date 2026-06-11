import SwiftUI

/// Todo list (PLAN.md 3.13 ekvivalent): klasický seznam ve stylu iOS Připomínek.
/// Kroužek = status Done/Todo (optimistický update), řazení podle termínu
/// (bez termínu na konec), přepínač „Skrýt hotové", podúkoly odsazené pod
/// rodičem, dokončené v samostatné sekci dole.
struct TodoListView: View {
    @ObservedObject var store: TaskStore
    var onOpen: (TaskItem) -> Void
    var onCreate: () -> Void

    /// Persistuje přes restarty appky i přepínání pohledů (UserDefaults).
    @AppStorage("todoHideDone") private var hideDone = false

    var body: some View {
        if store.tasks.isEmpty {
            VStack(spacing: 16) {
                Text("Zatím žádné úkoly").foregroundStyle(.secondary)
                Button("Vytvořit první úkol", action: onCreate)
                    .buttonStyle(.borderedProminent)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            List {
                Section {
                    Toggle("Skrýt hotové", isOn: $hideDone)
                } header: {
                    Text(remaining == 0 ? "Vše hotovo 🎉" : "Zbývá: \(remaining)")
                }

                Section {
                    ForEach(activeRoots) { task in
                        rowWithChildren(task)
                    }
                }

                if !doneRoots.isEmpty {
                    Section("Dokončené") {
                        ForEach(doneRoots) { task in
                            rowWithChildren(task)
                        }
                    }
                }
            }
            .listStyle(.insetGrouped)
        }
    }

    // MARK: - Data

    private var remaining: Int {
        store.tasks.reduce(0) { $0 + ($1.status == .done ? 0 : 1) }
    }

    /// Řazení podle termínu: s due date vzestupně, bez termínu na konec, sekundárně dle názvu.
    private func byDueDate(_ lhs: TaskItem, _ rhs: TaskItem) -> Bool {
        switch (lhs.dueDate, rhs.dueDate) {
        case let (left?, right?):
            return left == right
                ? lhs.name.localizedCompare(rhs.name) == .orderedAscending
                : left < right
        case (.some, .none):
            return true
        case (.none, .some):
            return false
        default:
            return lhs.name.localizedCompare(rhs.name) == .orderedAscending
        }
    }

    private var roots: [TaskItem] {
        store.tasks.filter { $0.parentId == nil }.sorted(by: byDueDate)
    }

    private func children(of id: String) -> [TaskItem] {
        store.subtasks(of: id).sorted(by: byDueDate)
    }

    private var activeRoots: [TaskItem] {
        roots.filter { $0.status != .done }
    }

    /// Hotový rodič s nedokončeným podúkolem se při skrytí hotových neskrývá
    /// (nedokončená práce nesmí zmizet) – stejné pravidlo jako web 3.13.
    private var doneRoots: [TaskItem] {
        roots.filter { task in
            guard task.status == .done else { return false }
            if hideDone {
                return !children(of: task.id).allSatisfy { $0.status == .done }
            }
            return true
        }
    }

    private func visibleChildren(of id: String) -> [TaskItem] {
        children(of: id).filter { !(hideDone && $0.status == .done) }
    }

    // MARK: - Řádky

    @ViewBuilder private func rowWithChildren(_ task: TaskItem) -> some View {
        row(task, depth: 0)
        ForEach(visibleChildren(of: task.id)) { child in
            row(child, depth: 1)
        }
    }

    private func row(_ task: TaskItem, depth: Int) -> some View {
        let done = task.status == .done
        let overdue = DateUtils.isOverdue(task.dueDate, status: task.status)
        return HStack(spacing: 12) {
            Button {
                Task { await store.update(id: task.id, .init(status: done ? .todo : .done)) }
            } label: {
                Image(systemName: done ? "checkmark.circle.fill" : "circle")
                    .font(.title3)
                    .foregroundStyle(done ? Color.accentColor : Color.secondary)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(
                done ? "Označit \(task.name) jako nedokončený" : "Označit \(task.name) jako hotový"
            )

            Text(task.name)
                .strikethrough(done)
                .foregroundStyle(done ? Color.secondary : Color.primary)
                .lineLimit(1)

            Spacer(minLength: 8)

            if let due = task.dueDate {
                Text(DateUtils.format(due))
                    .font(.caption)
                    .foregroundStyle(overdue ? Color.red : Color.secondary)
            }
        }
        .padding(.leading, depth == 0 ? 0 : 28)
        .contentShape(Rectangle())
        .onTapGesture { onOpen(task) }
        .accessibilityElement(children: .combine)
        .accessibilityHint("Otevře detail úkolu")
    }
}
