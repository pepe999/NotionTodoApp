import Foundation

/// Konfigurace běhového prostředí. Pro produkci přepiš na svou API doménu.
enum AppConfig {
    static let baseURL = URL(string: "http://localhost:3000")!
}

extension Notification.Name {
    /// APIClient ji posílá při 401 → AuthViewModel odhlásí uživatele.
    static let unauthorized = Notification.Name("nta.unauthorized")
}

enum APIError: Error, Equatable {
    case unauthorized
    case notFound
    case serverError(Int)
    case networkError
    case timeout
    case decoding
}

/// Síťová vrstva (PLAN.md 5.2): actor, async/await, sdílené cookies přes
/// `HTTPCookieStorage.shared`, 10s timeout, mapování chyb, 401 → Notification.
actor APIClient {
    static let shared = APIClient()

    private let baseURL: URL
    private let session: URLSession
    private let decoder = JSONDecoder()
    private let encoder = JSONEncoder()

    init(baseURL: URL = AppConfig.baseURL) {
        self.baseURL = baseURL
        let config = URLSessionConfiguration.default
        config.httpCookieStorage = HTTPCookieStorage.shared
        config.httpCookieAcceptPolicy = .always
        config.timeoutIntervalForRequest = 10
        self.session = URLSession(configuration: config)
    }

    // MARK: - Generický request

    @discardableResult
    func request<T: Decodable>(
        _ path: String,
        method: String = "GET",
        body: Encodable? = nil
    ) async throws -> T {
        var req = URLRequest(url: baseURL.appendingPathComponent(path))
        req.httpMethod = method
        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try encoder.encode(AnyEncodable(body))
        }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: req)
        } catch let error as URLError {
            throw error.code == .timedOut ? APIError.timeout : APIError.networkError
        }

        guard let http = response as? HTTPURLResponse else { throw APIError.networkError }
        switch http.statusCode {
        case 200..<300:
            if T.self == EmptyResponse.self { return EmptyResponse() as! T }
            do {
                return try decoder.decode(T.self, from: data)
            } catch {
                throw APIError.decoding
            }
        case 401:
            await MainActor.run { NotificationCenter.default.post(name: .unauthorized, object: nil) }
            throw APIError.unauthorized
        case 404:
            throw APIError.notFound
        default:
            throw APIError.serverError(http.statusCode)
        }
    }

    // MARK: - Endpointy

    func getTasks() async throws -> [TaskItem] {
        try await request("/api/tasks")
    }

    func createTask(_ input: CreateTaskInput) async throws -> TaskItem {
        try await request("/api/tasks", method: "POST", body: input)
    }

    func updateTask(id: String, _ input: UpdateTaskInput) async throws -> TaskItem {
        try await request("/api/tasks/\(id)", method: "PATCH", body: input)
    }

    func deleteTask(id: String) async throws {
        let _: EmptyResponse = try await request("/api/tasks/\(id)", method: "DELETE")
    }

    func createSubtask(parentId: String, _ input: CreateTaskInput) async throws -> TaskItem {
        try await request("/api/tasks/\(parentId)/subtasks", method: "POST", body: input)
    }

    func me() async throws -> AuthUser {
        try await request("/auth/me")
    }

    func logout() async throws {
        let _: EmptyResponse = try await request("/auth/logout", method: "POST")
    }

    func validateNotion(token: String, databaseId: String) async throws -> ValidateResult {
        try await request("/api/setup/validate", method: "POST",
                          body: SetupInput(token: token, databaseId: databaseId))
    }

    func saveNotion(token: String, databaseId: String) async throws {
        let _: EmptyResponse = try await request("/api/setup/save", method: "POST",
                                                 body: SetupInput(token: token, databaseId: databaseId))
    }

    /// Výměna ověřeného Google id_token za session cookie (PLAN.md 1.3/5.3).
    func authMobile(idToken: String) async throws -> AuthUser {
        try await request("/auth/mobile", method: "POST", body: ["id_token": idToken])
    }

    func registerDeviceToken(_ token: String) async throws {
        let _: EmptyResponse = try await request("/api/notifications/register", method: "POST",
                                                 body: ["token": token, "platform": "ios"])
    }
}

private struct SetupInput: Encodable {
    let token: String
    let databaseId: String
}

/// Marker pro odpovědi bez těla (204 apod.).
struct EmptyResponse: Decodable {}

/// Type-erasure pro `Encodable` body.
private struct AnyEncodable: Encodable {
    private let encodeFn: (Encoder) throws -> Void
    init(_ wrapped: Encodable) { encodeFn = wrapped.encode }
    func encode(to encoder: Encoder) throws { try encodeFn(encoder) }
}
