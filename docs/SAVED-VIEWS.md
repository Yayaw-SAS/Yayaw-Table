# Favorite and organization views

React and Vue provide the same favorite controls. Enable `table.enableViews`,
select a saved view, and press the star beside its name to use it on arrival.
Press the filled star to remove the favorite. Selecting another view does not
change the favorite. There is one favorite per table, and choosing another
replaces it.

Favorites reference saved configurations. Starring a modified view does not save
its pending edits; use **Save changes** first to include them. Shared and system
views can be favorites even when `allowViewSave` is false. Choosing a favorite
never changes a view's `config`, `isDefault`, `isGlobal`, or ownership.

## Arrival behavior

An explicit table URL state keeps precedence when URL synchronization is enabled.
Otherwise the manager chooses, once after loading:

1. `initialActiveViewId`, if supplied by the host.
2. The favorite, if it is present in the available views.
3. The first available view marked `isDefault`.
4. The catalogue's normal table configuration.

An invalid explicit `initialActiveViewId` leaves the normal configuration in
place. A deleted or inaccessible favorite is ignored. Late responses do not
replace table edits made during loading, and manually selecting the default view
does not immediately reapply the favorite. Removing a favorite leaves the current
view selected; the next arrival uses the normal fallback order.

## Persistence

Without preference handlers, the favorite is stored in the current browser's
localStorage under `yayaw-table-favorite:<JSON [tableType, tableId]>`. It can refer
to a remotely loaded view and does not require that view to exist in localStorage.
This fallback is browser-local: it is neither synchronized between devices nor
automatically isolated between accounts using the same browser.

Supply **both** `actions.views.getFavorite` and `actions.views.setFavorite` to
persist the preference on your server. Existing CRUD handlers remain compatible.
Both handlers receive `{ tableId, tableType }`; `setFavorite` also receives the
view ID, or `null` to clear it. The common response shape is:

```ts
// No favorite: viewId is null. React requires success; Vue also accepts its omission.
{ success: true, data: { viewId: "my-saved-view" } }

// A failed request leaves the current preference and table configuration intact.
{ success: false, error: "Unable to save your favorite view" }
```

Keep preferences in a separate record with a unique key such as
`(organizationId, userId, tableType, tableId)` and a nullable `viewId`. Resolve the
user and active organization from the authenticated server session. Validate that
the target view belongs to the requested table and is visible to that user. Clear
references when deleting a view, or return `viewId: null` when access is revoked.

The component has no authentication lifecycle. Use a table instance ID scoped to
the active organization and user when account switching must isolate browser
storage and query caches. Remount the table on scope changes and clear the old
React query cache at sign-out. The server must independently validate the scope;
a client-provided table ID is not authorization.

## What organization sharing currently means

`allowViewSharing` exposes the sharing checkbox in the save dialog. Checking it
sends `isGlobal: true` to `actions.views.create`. Shared views have a people icon.
`isGlobal` means shared within the scope enforced by the host application; it does
not make a view public on the Internet or establish organization membership.

This repository distributes UI components and persistence contracts. It does not
provide an organization database, membership service, or authorization backend.
The local adapter stores the sharing flag, but **does not distribute the view to
other people**. Real organization sharing requires the host's complete `list`,
`create`, `update`, and `delete` handlers. Omitted handlers fall back to local
storage, so supplying only `list` is not a complete shared-view integration.

The host backend should implement the following behavior:

| Action | Host responsibility |
| --- | --- |
| `list` | Return only system views, the current user's personal views, and shared views accessible in the active organization and table. |
| `create` | Set organization and owner from the session; check sharing permission before accepting `isGlobal: true`. |
| `update`, `delete` | Check organization, table, ownership or editor/admin permission for the target ID; protect system views. |
| `getFavorite`, `setFavorite` | Read/write only the current user's preference, independently of shared view records. |

`allowViewSave`, `allowViewSharing`, and `isSystem` control UI behavior. They are
not access controls: the frontend does not infer whether the current user owns a
shared view or is an organization admin. Other users' shared views may display
write controls when saving is enabled; the server must reject unauthorized
updates/deletions. Per-view role-aware edit controls are not part of the current
contract.

A typical result is that Alice and Bob can select the same organization view,
but Alice can favorite it while Bob favorites a different one. Neither changes
the other's arrival preference. Updating the shared configuration, when
permitted, affects everyone who later loads that saved view.
