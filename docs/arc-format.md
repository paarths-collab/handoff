# Arc sidebar format

The public arc-export reader uses sidebar.containers, the element following the global marker, and mixed string/object item arrays. It reads id, parentID, title, newContainerIDs and tab.savedTitle/savedURL. [Public reader](https://github.com/ivnvxd/arc-export/blob/main/main.py)

The implementation also supports the fallback container, childrenIds ordering, root Favorites, sections, folders, split flattening and recovery described in the build plan. Synthetic examples exercise these rules. Profile, color, icon, Favorites placement, exact section ordering and Windows variants require confirmation against user-provided files. Real-file surveying and anonymized fixture creation are deferred at the owner's request.

Additional public examples describe section roots as itemContainer, folders as list, splitView children, topAppsContainerIDs as a marker followed by an ID, and profiles as default or custom._0.directoryBasename. Arc can store iconType.emoji_v2 or an SF Symbol and nested RGB theme channels ranging from zero to one. The reader tolerates absent metadata. [Zen migration discussion](https://github.com/zen-browser/desktop/issues/9180) · [Arc format example](https://gist.github.com/moonexpr/ee693e762ebed68642ffad45c498e2ce) · [Space metadata](https://kb.macfor.io/docs/browsers/arc/spaces)

## Archived tabs

Optional recovery reads StorableArchiveItems.json from the sidebar's folder. Public source describes items as alternating entry IDs and objects, reason as auto or manual, sidebarItem.data.tab.savedURL/savedTitle, sidebarItem.title, source.space._0 as the Space ID, and archivedAt as seconds since 2001-01-01 UTC. [Public archive reader](https://github.com/plainspace/arcaeologist/blob/main/src/parser.js)

The core reader accepts alternating arrays and object-only arrays, reports unreadable entries and unknown reasons, and includes automatic archives after a separate user action. It keeps the latest exact URL per source Space, excludes URLs present in that Space or shared Favorites, and counts all exclusions. Unknown dates remain recoverable. Deleted or missing Space references get distinct recovered Spaces.

Recovered tabs live in ordinary folders under Today → Recovered archive → UTC month. Existing Space and Today choices govern native opening. Bookmarks, archive HTML, CSV and pack exports use the existing shared tree. Packs therefore retain recovery folders without a schema change. The sidebar input remains valid on its own. The reader uses public format evidence and synthetic fixtures. Compatibility with a user-provided archive still needs a real-file preview check.
