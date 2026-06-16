UniConnect — Navigation Architecture (Web + Mobile)

Overview
--------
This document describes the global, responsive navigation system implemented for UniConnect. It supports both React Web (react-native-web / Expo) and React Native (Expo), providing a consistent user experience across desktop, tablet and mobile.

Key features
------------
- Responsive Sidebar (desktop) — expandable / collapsible and persisted across tabs.
- Mobile Drawer (modal) + Bottom Navigation — accessible on phones and tablets.
- Header hamburger toggle for small screens.
- Role-based menu items (includes `super_admin` items when applicable).
- Real-time badges driven by the existing `NotificationContext` (WebSocket observer).
- Global Profile Search with debounce and basic pagination.
- Non-destructive: authentication flows and existing routing are untouched.

Files added
-----------
- `components/navigation/NavProvider.tsx` — central navigation context and menu computation.
- `components/navigation/Sidebar.tsx` — web sidebar (collapse/expand).
- `components/navigation/MobileMenu.tsx` — mobile modal drawer.
- `components/navigation/HeaderLeft.tsx` — header hamburger toggler for small screens.
- `components/navigation/GlobalNav.tsx` — chooses between sidebar / bottom nav / mobile menu.
- `app/assistant.tsx` — small wrapper page to expose `AssistantWidget` on its own route.
- `lib/student-api.ts` — extended `searchStudents` to support pagination/filters (backwards compatible).
- `app/student-search.tsx` — debounce + pagination improvements.

Integration points
------------------
- `app/_layout.tsx` now wraps the app in `NavProvider` and renders `GlobalNav`.
- `NotificationContext` is used to show unread counts and real-time updates.
- `loadSession()` is used to compute the user role to enable admin menu items.

Design notes
------------
- Menu items are defined in `NavProvider` and are easy to extend. Admin-only items are included when `session.user.role === 'super_admin'`.
- The `notifications` item uses `NotificationContext.setModalVisible(true)` instead of a route so it reuses the existing `NotificationModal`.
- Sidebar collapsed state is persisted in `localStorage` (web) and synchronized across tabs via the `storage` event. Cross-device persistence should be implemented server-side if needed.
- Bottom navigation is rendered as an overlay on mobile. This avoids modifying the existing Tab navigator and keeps the implementation non-invasive.

Extensibility and patterns
--------------------------
- Observer: `NotificationContext` acts as the WebSocket observer; menu badges consume `unreadCount`.
- Decorator: Student profile UI already uses decorators (`StudentProfileModal`) — the navigation merely links to the enriched profile.
- Strategy / Chain of Responsibility: `NavProvider` can compute menu items via pluggable providers or server-side feature flags in future.
- State: `NavProvider` centralizes navigation UI state (collapsed, mobileOpen, user).

Testing
-------
- Basic TypeScript checks were run for modified files. There is no full test harness added yet for navigation components; recommended next steps:
  - Add `@testing-library/react-native` + `jest` for component tests.
  - Unit test `NavProvider` for menu gating by role.
  - Integration test for mobile menu open/close and notifications badge rendering.

Developer notes
---------------
- Do not modify authentication flows — `loadSession()` is used to read session only.
- New components use existing `IconSymbol`, `NotificationContext`, and `router.push()` (expo-router).
- If you want server-side persistence for navigation preferences, extend the backend with a small endpoint and call it from `NavProvider`.

Next steps (optional)
---------------------
- Add Quick Access Dropdown component in header (small popup with favorite links).
- Implement server-side menu definitions and permission-based gating.
- Add unit & integration tests for navigation and permissions.

*** End of document
