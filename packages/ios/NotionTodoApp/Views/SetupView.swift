import SwiftUI

/// Setup wizard pro Notion (PLAN.md 5.x ekvivalent 3.3).
struct SetupView: View {
    var onDone: () -> Void

    @State private var token = ""
    @State private var databaseId = ""
    @State private var result: ValidateResult?
    @State private var busy = false
    @State private var error: String?

    private let api = APIClient.shared

    var body: some View {
        NavigationStack {
            Form {
                Section("Notion integrace") {
                    SecureField("Integration token (secret_…)", text: $token)
                        .textInputAutocapitalization(.never)
                    TextField("Database ID nebo URL", text: $databaseId)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                }

                if let result {
                    Section("Kontrola sloupců") {
                        ForEach(result.columns) { col in
                            HStack {
                                Image(systemName: col.ok ? "checkmark.circle.fill" : "xmark.circle.fill")
                                    .foregroundStyle(col.ok ? .green : .red)
                                Text(col.column)
                                Text("(\(col.expectedType))").foregroundStyle(.secondary)
                            }
                        }
                    }
                }

                if let error {
                    Text(error).foregroundStyle(.red)
                }

                Section {
                    Button("Ověřit") { Task { await validate() } }
                        .disabled(busy || token.isEmpty || databaseId.isEmpty)
                    if result?.valid == true {
                        Button("Uložit a pokračovat") { Task { await save() } }
                            .disabled(busy)
                    }
                }
            }
            .navigationTitle("Připojení Notion")
        }
    }

    private func validate() async {
        busy = true; error = nil
        defer { busy = false }
        do { result = try await api.validateNotion(token: token, databaseId: databaseId) }
        catch { error = "Validace selhala." }
    }

    private func save() async {
        busy = true; error = nil
        defer { busy = false }
        do { try await api.saveNotion(token: token, databaseId: databaseId); onDone() }
        catch { error = "Uložení selhalo." }
    }
}
