# NotionTodoApp — iOS (SwiftUI)

Nativní iOS klient (Fáze 5). **Buildí se výhradně lokálně v Xcode** – není npm
workspace ani součást Dockeru/CI (macOS runner je drahý, viz PLAN.md 0.4).

> ⚠️ Tento kód nebyl zkompilován v CI prostředí (chybí Swift/Xcode toolchain).
> Před prvním spuštěním ho ověř v Xcode na simulátoru.

## Struktura (MVVM)

```
NotionTodoApp/
  App/         NotionTodoAppApp, AppDelegate, ContentView
  Models/      Models.swift (TaskItem, AuthUser, ValidateResult, …)
  Services/    APIClient (actor), KeychainStore, PushManager
  ViewModels/  AuthViewModel, TaskStore
  Views/       Login, Setup, Dashboard, Kanban, Timeline (Canvas), Calendar, TaskDetail, CreateTask
  Components/   TaskCardView, StatusBadge
  Support/     DateUtils
```

## Vytvoření Xcode projektu (jednorázově)

1. Xcode → **New Project → iOS App** → název `NotionTodoApp`, interface **SwiftUI**,
   language **Swift**, ulož do `packages/ios/`.
2. Smaž vygenerovaný `ContentView.swift`/`*App.swift` a do projektu přidej
   složky z tohoto adresáře (**Add Files…**, „Create groups").
3. **Swift Package Manager** → přidej závislost
   `https://github.com/google/GoogleSignIn-iOS` (produkt `GoogleSignIn`).
4. **Signing & Capabilities** → zapni **Push Notifications** a **Background Modes →
   Remote notifications**.

## Konfigurace

- **API URL**: `Services/APIClient.swift` → `AppConfig.baseURL`
  (dev: `http://localhost:3000`; pro simulátor proti lokálnímu backendu povol
  ATS výjimku, viz níže).
- **Google Sign-In** (`Info.plist`):
  - `GIDClientID` = iOS OAuth client ID z Google Cloud Console (PLAN.md 5.3),
  - URL Types → URL Scheme = reverzní client ID (`com.googleusercontent.apps.…`).
- **App Transport Security** (jen pro lokální dev HTTP):
  ```xml
  <key>NSAppTransportSecurity</key>
  <dict><key>NSAllowsLocalNetworking</key><true/></dict>
  ```

## SwiftLint

`.swiftlint.yml` v této složce. Instalace: `brew install swiftlint`, integrace
přes Build Phase „Run Script": `if which swiftlint; then swiftlint; fi`.

## Push notifikace (5.8)

Klient po přihlášení požádá o oprávnění a pošle APNs device token na
`POST /api/notifications/register`. Odesílání řeší backend (token-based APNs,
`.p8` klíč jako secret `APNS_*`).
