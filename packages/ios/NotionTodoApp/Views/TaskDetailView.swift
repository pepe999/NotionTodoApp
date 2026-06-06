import SwiftUI

/// Detail úkolu s editací a podúkoly (PLAN.md 5.7). Ukládání s debounce 0,5 s.
struct TaskDetailView: View {
    @ObservedObject var store: TaskStore
    let taskId: String

    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var status: TaskStatus = .todo
    @State private var newSubtask = ""
    @State private var saveTask: Task<Void, Never>?

    private var task: TaskItem? { store.tasks.first { $0.id == taskId } }

    var body: some View {
        NavigationStack {
            Form {
                if let parent = parentTask {
                    Section { Label(parent.name, systemImage: "arrow.turn.left.up") }
                }

                Section("Úkol") {
                    TextField("Název", text: $name)
                        .onChange(of: name) { scheduleSave() }
                    Picker("Status", selection: $status) {
                        ForEach(TaskStatus.allCases) { Text($0.rawValue).tag($0) }
                    }
                    .onChange(of: status) { Task { await store.update(id: taskId, .init(status: status)) } }
                }

                Section("Podúkoly") {
                    ForEach(store.subtasks(of: taskId)) { sub in
                        Toggle(isOn: doneBinding(for: sub)) { Text(sub.name) }
                    }
                    .onDelete { offsets in deleteSubtasks(offsets) }
                    HStack {
                        TextField("Nový podúkol", text: $newSubtask)
                        Button("Přidat") { Task { await addSubtask() } }
                            .disabled(newSubtask.trimmingCharacters(in: .whitespaces).isEmpty)
                    }
                }

                if let task, !task.dependsOnIds.isEmpty {
                    Section("Závisí na") {
                        ForEach(dependencies) { dep in Text(dep.name) }
                    }
                }

                Section {
                    Button("Smazat úkol", role: .destructive) {
                        Task { await store.delete(id: taskId); dismiss() }
                    }
                }
            }
            .navigationTitle("Detail")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Hotovo") { dismiss() } }
            }
            .onAppear {
                name = task?.name ?? ""
                status = task?.status ?? .todo
            }
        }
    }

    private var parentTask: TaskItem? {
        guard let parentId = task?.parentId else { return nil }
        return store.tasks.first { $0.id == parentId }
    }

    private var dependencies: [TaskItem] {
        guard let ids = task?.dependsOnIds else { return [] }
        return store.tasks.filter { ids.contains($0.id) }
    }

    private func doneBinding(for sub: TaskItem) -> Binding<Bool> {
        Binding(
            get: { sub.status == .done },
            set: { isDone in
                Task { await store.update(id: sub.id, .init(status: isDone ? .done : .todo)) }
            }
        )
    }

    private func scheduleSave() {
        saveTask?.cancel()
        saveTask = Task {
            try? await Task.sleep(nanoseconds: 500_000_000)
            guard !Task.isCancelled else { return }
            await store.update(id: taskId, .init(name: name))
        }
    }

    private func addSubtask() async {
        await store.addSubtask(parentId: taskId, name: newSubtask.trimmingCharacters(in: .whitespaces))
        newSubtask = ""
    }

    private func deleteSubtasks(_ offsets: IndexSet) {
        let subs = store.subtasks(of: taskId)
        for index in offsets {
            let id = subs[index].id
            Task { await store.delete(id: id) }
        }
    }
}
