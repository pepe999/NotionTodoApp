import SwiftUI

struct CreateTaskView: View {
    @ObservedObject var store: TaskStore
    var defaultDue: Date?

    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var status: TaskStatus = .todo
    @State private var hasDue = false
    @State private var due = Date()
    @State private var tags = ""

    var body: some View {
        NavigationStack {
            Form {
                TextField("Název", text: $name)
                Picker("Status", selection: $status) {
                    ForEach(TaskStatus.allCases) { Text($0.rawValue).tag($0) }
                }
                Toggle("Termín", isOn: $hasDue)
                if hasDue {
                    DatePicker("Datum", selection: $due, displayedComponents: .date)
                }
                TextField("Tagy (oddělené čárkou)", text: $tags)
                    .autocorrectionDisabled()
            }
            .navigationTitle("Nový úkol")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Zrušit") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Vytvořit") { Task { await create() } }
                        .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
            .onAppear {
                if let defaultDue { hasDue = true; due = defaultDue }
            }
        }
    }

    private func create() async {
        let input = CreateTaskInput(
            name: name.trimmingCharacters(in: .whitespaces),
            status: status,
            tags: tags.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty },
            dueDate: hasDue ? DateUtils.isoDay(due) : nil
        )
        await store.create(input)
        dismiss()
    }
}
