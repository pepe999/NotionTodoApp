import Foundation
import SwiftUI
import GoogleSignIn

/// Auth stav aplikace (PLAN.md 5.3). Google Sign-In → /auth/mobile → session cookie.
@MainActor
final class AuthViewModel: ObservableObject {
    @Published var currentUser: AuthUser?
    @Published var isLoading = true
    @Published var errorMessage: String?

    private let api = APIClient.shared

    init() {
        NotificationCenter.default.addObserver(
            forName: .unauthorized, object: nil, queue: .main
        ) { [weak self] _ in
            Task { @MainActor in self?.currentUser = nil }
        }
    }

    /// Obnoví session při startu (cookie persistuje HTTPCookieStorage).
    func bootstrap() async {
        isLoading = true
        defer { isLoading = false }
        currentUser = try? await api.me()
    }

    func signIn() async {
        errorMessage = nil
        guard let presenting = Self.rootViewController() else { return }
        do {
            let result = try await GIDSignIn.sharedInstance.signIn(withPresenting: presenting)
            guard let idToken = result.user.idToken?.tokenString else {
                errorMessage = "Chybí Google id_token."
                return
            }
            currentUser = try await api.authMobile(idToken: idToken)
            PushManager.shared.requestAuthorizationAndRegister()
        } catch {
            errorMessage = "Přihlášení selhalo."
        }
    }

    func logout() async {
        try? await api.logout()
        GIDSignIn.sharedInstance.signOut()
        currentUser = nil
    }

    private static func rootViewController() -> UIViewController? {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
            .first { $0.isKeyWindow }?
            .rootViewController
    }
}
