import SwiftUI

struct DashboardView: View {
    @EnvironmentObject private var auth: AuthViewModel
    @StateObject private var store = TaskStore()

    @State private var view: ViewKind = .kanban
    @State private var showCreate = false
    @State private var createDue: Date?
    @State private var selected: TaskItem?

    enum ViewKind: String, CaseIterable, Identifiable {
        case kanban = "Kanban"
        case timeline = "Časová osa"
        case calendar = "Kalendář"
        var id: String { rawValue }
    }

    var body: some View {
        NavigationStack {
            content
                .navigationTitle("Úkoly")
                .toolbar {
                    ToolbarItem(placement: .principal) {
                        Picker("Pohled", selection: $view) {
                            ForEach(ViewKind.allCases) { Text($0.rawValue).tag($0) }
                        }
                        .pickerStyle(.segmented)
                    }
                    ToolbarItem(placement: .topBarTrailing) {
                        Button { createDue = nil; showCreate = true } label: { Image(systemName: "plus") }
                    }
                    ToolbarItem(placement: .topBarLeading) {
                        Menu {
                            Button("Odhlásit", role: .destructive) { Task { await auth.logout() } }
                        } label: {
                            Image(systemName: "person.crop.circle")
                        }
                    }
                }
                .sheet(isPresented: $showCreate) {
                    CreateTaskView(store: store, defaultDue: createDue)
                }
                .sheet(item: $selected) { task in
                    TaskDetailView(store: store, taskId: task.id)
                }
                .task { await store.load() }
        }
    }

    @ViewBuilder private var content: some View {
        if store.needsSetup {
            SetupView { Task { await store.load() } }
        } else {
            switch view {
            case .kanban:
                KanbanView(store: store, onOpen: { selected = $0 }, onCreate: { showCreate = true })
                    .refreshable { await store.load() }
            case .timeline:
                TimelineView(store: store, onOpen: { selected = $0 })
            case .calendar:
                CalendarView(
                    store: store,
                    onOpen: { selected = $0 },
                    onCreate: { day in createDue = day; showCreate = true }
                )
            }
        }
    }
}
