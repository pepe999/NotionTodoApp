import Foundation

/// Doménové modely odpovídající `@notiontodoapp/shared` (PLAN.md 5.2).
/// Hodnoty statusů jsou shodné s Notion select volbami.
enum TaskStatus: String, Codable, CaseIterable, Identifiable {
    case todo = "Todo"
    case inProgress = "In Progress"
    case review = "Review"
    case done = "Done"

    var id: String { rawValue }
}

struct Timeline: Codable, Hashable {
    let start: String
    let end: String
}

struct TaskItem: Codable, Identifiable, Hashable {
    let id: String
    var name: String
    var status: TaskStatus
    var tags: [String]
    var dueDate: String?
    var timeline: Timeline?
    var ownerIds: [String]
    var description: String
    var dependsOnIds: [String]
    var parentId: String?
    var lastEditedTime: String
    var url: String
}

/// Vstup pro vytvoření úkolu (zrcadlí createTaskInputSchema).
struct CreateTaskInput: Codable {
    var name: String
    var status: TaskStatus = .todo
    var tags: [String] = []
    var dueDate: String?
    var timeline: Timeline?
    var ownerIds: [String] = []
    var description: String?
    var dependsOnIds: [String] = []
    var parentId: String?
}

/// Vstup pro úpravu – pouze nastavená pole se odešlou (absent = beze změny).
struct UpdateTaskInput: Codable {
    var name: String?
    var status: TaskStatus?
    var tags: [String]?
    var dueDate: String?
    var description: String?
}

struct AuthUser: Codable, Identifiable {
    let id: String
    let email: String
    let name: String?
    let avatarUrl: String?
}

struct ColumnCheck: Codable, Identifiable {
    var column: String
    var expectedType: String
    var ok: Bool
    var actualType: String?
    var message: String?

    var id: String { column }
}

struct ValidateResult: Codable {
    let valid: Bool
    let columns: [ColumnCheck]
}
