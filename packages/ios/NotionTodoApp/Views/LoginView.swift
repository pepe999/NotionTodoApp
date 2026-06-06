import SwiftUI

struct LoginView: View {
    @EnvironmentObject private var auth: AuthViewModel

    var body: some View {
        VStack(spacing: 24) {
            Image(systemName: "checklist")
                .font(.system(size: 56))
                .foregroundStyle(.tint)
            VStack(spacing: 6) {
                Text("NotionTodoApp").font(.title.bold())
                Text("Úkoly nad tvou Notion databází")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            Button {
                Task { await auth.signIn() }
            } label: {
                Label("Přihlásit přes Google", systemImage: "person.crop.circle")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)

            if let error = auth.errorMessage {
                Text(error).font(.footnote).foregroundStyle(.red)
            }
        }
        .padding(32)
    }
}
