import Foundation
import SwiftUI

/// Stav úkolů (PLAN.md 5.x). Jeden zdroj pravdy – flat list z backendu; hierarchie
/// a počty podúkolů se počítají lokálně. Mutace jsou optimistické s reloadem.
@MainActor
final class TaskStore: ObservableObject {
    @Published var tasks: [TaskItem] = []
    @Published var isLoading = false
    @Published var needsSetup = false
    @Published var errorMessage: String?

    private let api = APIClient.shared

    func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            tasks = try await api.getTasks()
            needsSetup = false
        } catch APIError.serverError(let code) where code == 400 {
            needsSetup = true
        } catch {
            errorMessage = "Načtení úkolů selhalo."
        }
    }

    func topLevel(status: TaskStatus) -> [TaskItem] {
        tasks.filter { $0.parentId == nil && $0.status == status }
    }

    func subtasks(of parentId: String) -> [TaskItem] {
        tasks.filter { $0.parentId == parentId }
    }

    func subtaskCount(_ parentId: String) -> Int {
        tasks.reduce(0) { $0 + ($1.parentId == parentId ? 1 : 0) }
    }

    func tasks(onDay day: Date, calendar: Calendar = .current) -> [TaskItem] {
        tasks.filter { item in
            guard let due = item.dueDate, let date = DateUtils.parse(due) else { return false }
            return calendar.isDate(date, inSameDayAs: day)
        }
    }

    // MARK: - Mutace (optimistické)

    func create(_ input: CreateTaskInput) async {
        do {
            let created = try await api.createTask(input)
            tasks.append(created)
        } catch {
            errorMessage = "Vytvoření úkolu selhalo."
            await load()
        }
    }

    func update(id: String, _ input: UpdateTaskInput) async {
        let snapshot = tasks
        if let idx = tasks.firstIndex(where: { $0.id == id }) {
            if let status = input.status { tasks[idx].status = status }
            if let name = input.name { tasks[idx].name = name }
        }
        do {
            _ = try await api.updateTask(id: id, input)
        } catch {
            tasks = snapshot
            errorMessage = "Uložení změny selhalo."
        }
    }

    func delete(id: String) async {
        let snapshot = tasks
        tasks.removeAll { $0.id == id || $0.parentId == id }
        do {
            try await api.deleteTask(id: id)
        } catch {
            tasks = snapshot
            errorMessage = "Smazání selhalo."
        }
    }

    func addSubtask(parentId: String, name: String) async {
        do {
            let created = try await api.createSubtask(parentId: parentId, .init(name: name))
            tasks.append(created)
        } catch {
            errorMessage = "Přidání podúkolu selhalo."
        }
    }
}
