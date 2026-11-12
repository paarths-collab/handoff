# Arc sidebar format

The public arc-export reader uses sidebar.containers, the element following the global marker, and mixed string/object item arrays. It reads id, parentID, title, newContainerIDs and tab.savedTitle/savedURL. [Public reader](https://github.com/ivnvxd/arc-export/blob/main/main.py)

The implementation also supports the fallback container, childrenIds ordering, root Favorites, sections, folders, split flattening and recovery described in the build plan. Synthetic examples exercise these rules. Profile, color, icon, Favorites placement, exact section ordering and Windows variants require confirmation against user-provided files. Real-file surveying and anonymized fixture creation are deferred at the owner's request.

Additional public examples describe section roots as itemContainer, folders as list, splitView children, topAppsContainerIDs as a marker followed by an ID, and profiles as default or custom._0.directoryBasename. Arc can store iconType.emoji_v2 or an SF Symbol and nested RGB theme channels ranging from zero to one. The reader tolerates absent metadata. [Zen migration discussion](https://github.com/zen-browser/desktop/issues/9180) · [Arc format example](https://gist.github.com/moonexpr/ee693e762ebed68642ffad45c498e2ce) · [Space metadata](https://kb.macfor.io/docs/browsers/arc/spaces)
