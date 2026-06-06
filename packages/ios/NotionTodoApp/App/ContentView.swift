import SwiftUI

/// Kořenové přepínání: loading → login → dashboard (PLAN.md 5.1).
struct ContentView: View {
    @EnvironmentObject private var auth: AuthViewModel

    var body: some View {
        Group {
            if auth.isLoading {
                ProgressView("Načítání…")
            } else if auth.currentUser == nil {
                LoginView()
            } else {
                DashboardView()
            }
        }
    }
}
