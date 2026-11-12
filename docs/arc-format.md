# Arc sidebar format

The public arc-export reader uses sidebar.containers, the element following the global marker, and mixed string/object item arrays. It reads id, parentID, title, newContainerIDs and tab.savedTitle/savedURL. [Public reader](https://github.com/ivnvxd/arc-export/blob/main/main.py)

The implementation also supports the fallback container, childrenIds ordering, root Favorites, sections, folders, split flattening and recovery described in the build plan. Synthetic examples exercise these rules. Profile, color, icon, Favorites placement, exact section ordering and Windows variants require confirmation against user-provided files. Real-file surveying and anonymized fixture creation are deferred at the owner's request.
