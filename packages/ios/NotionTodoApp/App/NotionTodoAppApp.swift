import SwiftUI
import GoogleSignIn

@main
struct NotionTodoAppApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var auth = AuthViewModel()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(auth)
                .onOpenURL { url in GIDSignIn.sharedInstance.handle(url) }
                .task { await auth.bootstrap() }
        }
    }
}
