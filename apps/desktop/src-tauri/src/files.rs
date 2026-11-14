use serde::Serialize;
use std::{
    collections::HashSet,
    fs::{self, File, OpenOptions},
    io::{Read, Write},
    path::{Component, Path, PathBuf},
    sync::Mutex,
};
use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;

const LIMIT: u64 = 100 * 1024 * 1024;
#[derive(Default)]
pub struct Grants(Mutex<HashSet<PathBuf>>);
#[derive(Serialize)]
pub struct Sidebar {
    path: PathBuf,
    size: u64,
    modified: Option<u64>,
}

fn sidebar_under(base: &Path, relative: &Path) -> Option<PathBuf> {
    // Validate before joining: Windows verbatim paths normalize `..` in join().
    if relative.as_os_str().is_empty()
        || relative
            .components()
            .any(|part| !matches!(part, Component::Normal(_)))
    {
        return None;
    }
    let base = base.canonicalize().ok()?;
    let expected = base.join(relative);
    // Discovery never grants a symbolic link to another file.
    let actual = expected.canonicalize().ok()?;
    (expected == actual && actual.is_file()).then_some(actual)
}
fn metadata(path: PathBuf) -> Result<Sidebar, String> {
    let info = fs::metadata(&path).map_err(|_| "Cannot inspect this sidebar.")?;
    let modified = info
        .modified()
        .ok()
        .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs());
    Ok(Sidebar {
        path,
        size: info.len(),
        modified,
    })
}
#[tauri::command]
pub fn find_arc_files(grants: State<Grants>) -> Result<Vec<Sidebar>, String> {
    let mut candidates = Vec::new();
    #[cfg(target_os = "macos")]
    if let Some(home) = dirs::home_dir() {
        candidates.extend(sidebar_under(
            &home,
            Path::new("Library/Application Support/Arc/StorableSidebar.json"),
        ));
    }
    #[cfg(target_os = "windows")]
    if let Some(packages) = dirs::data_local_dir().map(|p| p.join("Packages")) {
        if let Ok(entries) = packages.read_dir() {
            for entry in entries.flatten() {
                let name = entry.file_name();
                if name.to_string_lossy().starts_with("TheBrowserCompany.Arc_") {
                    candidates.extend(sidebar_under(
                        &packages,
                        &PathBuf::from(name).join("LocalCache/Local/Arc/StorableSidebar.json"),
                    ));
                }
            }
        }
    }
    let mut allowed = grants.0.lock().map_err(|_| "Cannot access file grants.")?;
    candidates
        .into_iter()
        .map(|path| {
            allowed.insert(path.clone());
            metadata(path)
        })
        .collect()
}

#[tauri::command]
pub async fn pick_sidebar(
    app: AppHandle,
    grants: State<'_, Grants>,
) -> Result<Option<Sidebar>, String> {
    let Some(file) = app
        .dialog()
        .file()
        .add_filter("Sidebar or Handoff pack", &["json"])
        .blocking_pick_file()
    else {
        return Ok(None);
    };
    let path = file
        .into_path()
        .map_err(|_| "Choose a local JSON file.")?
        .canonicalize()
        .map_err(|_| "Cannot open this file.")?;
    if !path.is_file()
        || !path
            .extension()
            .is_some_and(|s| s.eq_ignore_ascii_case("json"))
    {
        return Err("Choose a local JSON file.".into());
    }
    grants
        .0
        .lock()
        .map_err(|_| "Cannot access file grants.")?
        .insert(path.clone());
    metadata(path).map(Some)
}
fn read_allowed(path: &Path, grants: &Grants) -> Result<String, String> {
    let denied = || String::from("Choose the sidebar again to allow access.");
    if !path.is_absolute()
        || path
            .components()
            .any(|part| matches!(part, Component::ParentDir))
    {
        return Err(denied());
    }
    let canonical = path.canonicalize().map_err(|_| denied())?;
    if path != canonical || !grants.0.lock().map_err(|_| denied())?.contains(&canonical) {
        return Err(denied());
    }
    let mut options = OpenOptions::new();
    options.read(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.custom_flags(libc::O_NOFOLLOW | libc::O_NONBLOCK);
    }
    let file = options.open(&canonical).map_err(|_| denied())?;
    let meta = file.metadata().map_err(|_| denied())?;
    if !meta.is_file() {
        return Err(denied());
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::MetadataExt;
        let fresh = fs::metadata(&canonical).map_err(|_| denied())?;
        if (fresh.dev(), fresh.ino()) != (meta.dev(), meta.ino())
            || canonical.canonicalize().map_err(|_| denied())? != canonical
        {
            return Err(denied());
        }
    }
    if meta.len() > LIMIT {
        return Err("Sidebar exceeds the 100 MiB limit.".into());
    }
    let mut bytes = Vec::new();
    file.take(LIMIT + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| denied())?;
    if bytes.len() as u64 > LIMIT {
        return Err("Sidebar exceeds the 100 MiB limit.".into());
    }
    String::from_utf8(bytes).map_err(|_| "Choose a UTF-8 JSON file.".into())
}
#[tauri::command]
pub async fn read_arc_file(path: PathBuf, grants: State<'_, Grants>) -> Result<String, String> {
    read_allowed(&path, &grants)
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Format {
    Bookmarks,
    Pack,
    Csv,
}
#[tauri::command]
pub async fn save_export(app: AppHandle, format: Format, contents: String) -> Result<bool, String> {
    let (name, ext) = match format {
        Format::Bookmarks => ("bookmarks.html", "html"),
        Format::Pack => ("handoff-pack.json", "json"),
        Format::Csv => ("tabs.csv", "csv"),
    };
    let mut picker = app
        .dialog()
        .file()
        .set_file_name(name)
        .add_filter("Export", &[ext]);
    if let Some(dir) = dirs::download_dir() {
        picker = picker.set_directory(dir)
    }
    let Some(file) = picker.blocking_save_file() else {
        return Ok(false);
    };
    let path = file.into_path().map_err(|_| "Choose a local file.")?;
    if !path
        .extension()
        .is_some_and(|s| s.eq_ignore_ascii_case(ext))
    {
        return Err(format!("Choose a .{ext} destination."));
    }
    let parent = path.parent().ok_or("Choose a local folder.")?;
    let save = || -> std::io::Result<()> {
        let mut tmp = tempfile::NamedTempFile::new_in(parent)?;
        tmp.write_all(contents.as_bytes())?;
        tmp.as_file().sync_all()?;
        tmp.persist(&path)?;
        Ok(())
    };
    save()
        .map(|()| true)
        .map_err(|_| "Could not save the export.".into())
}
#[tauri::command]
pub async fn save_archive(app: AppHandle, html: String, pack: String) -> Result<bool, String> {
    let Some(folder) = app
        .dialog()
        .file()
        .set_title("Choose a parent folder for your Arc Archive")
        .blocking_pick_folder()
    else {
        return Ok(false);
    };
    let dir = folder.into_path().map_err(|_| "Choose a local folder.")?;
    // Record the folder's real location now, so a later swap can be detected.
    let picked = fs::canonicalize(&dir).map_err(|_| "Choose a local folder.")?;
    create_archive(&dir, &picked, html.as_bytes(), pack.as_bytes())
        .map(|_| true)
        .map_err(|_| "Could not save the archive.".into())
}

/// Creates a unique "Arc Archive" child of `dir` holding archive.html and pack.json, and
/// leaves earlier exports and existing files alone. On Unix every step goes through one
/// handle to the chosen folder, so a symlink or swapped folder cannot redirect the writes.
#[cfg(unix)]
fn create_archive(dir: &Path, picked: &Path, html: &[u8], pack: &[u8]) -> std::io::Result<PathBuf> {
    use std::{
        ffi::CString,
        io::{Error, ErrorKind},
        os::unix::{
            ffi::OsStrExt,
            io::{AsRawFd, FromRawFd, OwnedFd},
        },
    };
    let c = |bytes: &[u8]| CString::new(bytes).map_err(|_| Error::from(ErrorKind::InvalidInput));
    let dir_flags = libc::O_RDONLY | libc::O_DIRECTORY | libc::O_NOFOLLOW | libc::O_CLOEXEC;
    let fd = |raw: libc::c_int| {
        if raw < 0 {
            Err(Error::last_os_error())
        } else {
            // SAFETY: a non-negative descriptor was just returned to us and is owned here.
            Ok(unsafe { OwnedFd::from_raw_fd(raw) })
        }
    };
    // SAFETY: the path is a valid NUL-terminated C string for the duration of the call.
    let parent = fd(unsafe { libc::open(c(dir.as_os_str().as_bytes())?.as_ptr(), dir_flags) })?;
    #[cfg(target_os = "macos")]
    {
        // The opened folder must still be the one the user picked.
        let mut buf = vec![0u8; libc::PATH_MAX as usize];
        // SAFETY: F_GETPATH writes at most PATH_MAX bytes into the buffer.
        if unsafe { libc::fcntl(parent.as_raw_fd(), libc::F_GETPATH, buf.as_mut_ptr()) } < 0 {
            return Err(Error::last_os_error());
        }
        let end = buf.iter().position(|&b| b == 0).unwrap_or(buf.len());
        if std::ffi::OsStr::from_bytes(&buf[..end]) != picked.as_os_str() {
            return Err(Error::other("The chosen folder changed."));
        }
    }
    #[cfg(not(target_os = "macos"))]
    let _ = picked;
    let write = |dir: &OwnedFd, name: &[u8], bytes: &[u8]| -> std::io::Result<()> {
        let flags =
            libc::O_WRONLY | libc::O_CREAT | libc::O_EXCL | libc::O_NOFOLLOW | libc::O_CLOEXEC;
        // SAFETY: valid directory descriptor and NUL-terminated name.
        let file = fd(unsafe {
            libc::openat(
                dir.as_raw_fd(),
                c(name)?.as_ptr(),
                flags,
                0o644 as libc::c_uint,
            )
        })?;
        let mut file = File::from(file);
        file.write_all(bytes)?;
        file.sync_all()
    };
    use std::hash::{BuildHasher, Hasher};
    let mut seed = std::collections::hash_map::RandomState::new().build_hasher();
    for attempt in 0..64u64 {
        seed.write_u64(attempt);
        let name = format!("Arc Archive {:012x}", seed.finish() & 0xffff_ffff_ffff);
        let cname = c(name.as_bytes())?;
        // SAFETY: valid directory descriptor and NUL-terminated name.
        if unsafe { libc::mkdirat(parent.as_raw_fd(), cname.as_ptr(), 0o755 as libc::mode_t) } != 0
        {
            let error = Error::last_os_error();
            if error.kind() == ErrorKind::AlreadyExists {
                continue;
            }
            return Err(error);
        }
        // SAFETY: valid directory descriptor and NUL-terminated name.
        let child = fd(unsafe { libc::openat(parent.as_raw_fd(), cname.as_ptr(), dir_flags) })?;
        let written =
            write(&child, b"archive.html", html).and_then(|()| write(&child, b"pack.json", pack));
        if let Err(error) = written {
            // Remove the partial archive; every name is relative to our own handles.
            for file in [&b"archive.html"[..], b"pack.json"] {
                if let Ok(file) = c(file) {
                    // SAFETY: valid directory descriptor and NUL-terminated name.
                    unsafe { libc::unlinkat(child.as_raw_fd(), file.as_ptr(), 0) };
                }
            }
            // SAFETY: valid directory descriptor and NUL-terminated name.
            unsafe { libc::unlinkat(parent.as_raw_fd(), cname.as_ptr(), libc::AT_REMOVEDIR) };
            return Err(error);
        }
        return Ok(dir.join(name));
    }
    Err(ErrorKind::AlreadyExists.into())
}

/// Windows has no descriptor-relative creation here; picker paths are used directly.
#[cfg(not(unix))]
fn create_archive(
    dir: &Path,
    _picked: &Path,
    html: &[u8],
    pack: &[u8],
) -> std::io::Result<PathBuf> {
    let tmp = tempfile::Builder::new()
        .prefix("Arc Archive ")
        .tempdir_in(dir)?;
    fn write(path: PathBuf, bytes: &[u8]) -> std::io::Result<()> {
        let mut file = File::create_new(path)?;
        file.write_all(bytes)?;
        file.sync_all()
    }
    write(tmp.path().join("archive.html"), html)?;
    write(tmp.path().join("pack.json"), pack)?;
    Ok(tmp.keep())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn grants_match_exact_discovered_files() {
        let dir = tempfile::tempdir().unwrap();
        let dir = dir.path().canonicalize().unwrap();
        let file = dir.join("StorableSidebar.json");
        fs::write(&file, "{}").unwrap();
        assert_eq!(
            sidebar_under(&dir, Path::new("StorableSidebar.json")),
            Some(file.clone())
        );
        let grants = Grants::default();
        assert!(read_allowed(&file, &grants).is_err());
        grants.0.lock().unwrap().insert(file.clone());
        assert_eq!(read_allowed(&file, &grants).unwrap(), "{}");
        fs::create_dir(dir.join("sub")).unwrap();
        // Avoid PathBuf::join here: it removes `..` for verbatim Windows bases.
        let mut raw = dir.as_os_str().to_os_string();
        raw.push(std::path::MAIN_SEPARATOR.to_string());
        raw.push(format!(
            "sub{sep}..{sep}StorableSidebar.json",
            sep = std::path::MAIN_SEPARATOR
        ));
        let traversal = PathBuf::from(raw);
        assert!(traversal
            .components()
            .any(|part| matches!(part, Component::ParentDir)));
        assert!(read_allowed(&traversal, &grants).is_err());
    }
    #[test]
    #[cfg(unix)]
    fn changed_file_link_is_denied() {
        let temp = tempfile::tempdir().unwrap();
        let dir = temp.path().canonicalize().unwrap();
        let file = dir.join("StorableSidebar.json");
        fs::write(dir.join("other.json"), "{}").unwrap();
        std::os::unix::fs::symlink(dir.join("other.json"), &file).unwrap();
        let grants = Grants::default();
        grants.0.lock().unwrap().insert(file.clone());
        assert!(sidebar_under(&dir, Path::new("StorableSidebar.json")).is_none());
        assert!(read_allowed(&file, &grants).is_err());
    }

    // Hostile-input checks for the read allowlist (plan rule 11).
    fn granted(dir: &Path, name: &str, body: &[u8]) -> (PathBuf, Grants) {
        let file = dir.join(name);
        fs::write(&file, body).unwrap();
        let grants = Grants::default();
        grants.0.lock().unwrap().insert(file.clone());
        (file, grants)
    }
    #[test]
    fn attack_ungranted_sibling_and_relative_paths_are_denied() {
        let temp = tempfile::tempdir().unwrap();
        let dir = temp.path().canonicalize().unwrap();
        let (_, grants) = granted(&dir, "StorableSidebar.json", b"{}");
        fs::write(dir.join("secret.json"), "{}").unwrap();
        assert!(read_allowed(&dir.join("secret.json"), &grants).is_err());
        assert!(read_allowed(Path::new("StorableSidebar.json"), &grants).is_err());
    }
    #[test]
    fn attack_discovery_cannot_escape_its_base() {
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path().canonicalize().unwrap();
        fs::create_dir(root.join("base")).unwrap();
        fs::write(root.join("outside.json"), "{}").unwrap();
        assert!(sidebar_under(&root.join("base"), Path::new("../outside.json")).is_none());
        assert!(sidebar_under(&root.join("base"), &root.join("outside.json")).is_none());
        fs::create_dir(root.join("base/sub")).unwrap();
        fs::write(root.join("base/sub/sidebar.json"), "{}").unwrap();
        assert_eq!(
            sidebar_under(&root.join("base"), Path::new("sub/sidebar.json")),
            Some(root.join("base/sub/sidebar.json"))
        );
        assert!(sidebar_under(&root.join("base"), Path::new("sub/../../outside.json")).is_none());
        fs::create_dir(root.join("base/StorableSidebar.json")).unwrap();
        assert!(sidebar_under(&root.join("base"), Path::new("StorableSidebar.json")).is_none());
    }
    #[test]
    #[cfg(unix)]
    fn attack_symlinked_parent_directory_is_denied() {
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path().canonicalize().unwrap();
        fs::create_dir_all(root.join("elsewhere/Arc")).unwrap();
        fs::write(root.join("elsewhere/Arc/StorableSidebar.json"), "{}").unwrap();
        fs::create_dir(root.join("home")).unwrap();
        std::os::unix::fs::symlink(root.join("elsewhere/Arc"), root.join("home/Arc")).unwrap();
        assert!(sidebar_under(&root.join("home"), Path::new("Arc/StorableSidebar.json")).is_none());
        let grants = Grants::default();
        let linked = root.join("home/Arc/StorableSidebar.json");
        grants.0.lock().unwrap().insert(linked.clone());
        assert!(read_allowed(&linked, &grants).is_err());
    }
    #[test]
    fn attack_granted_directory_is_denied() {
        let temp = tempfile::tempdir().unwrap();
        let dir = temp.path().canonicalize().unwrap();
        let grants = Grants::default();
        grants.0.lock().unwrap().insert(dir.clone());
        assert!(read_allowed(&dir, &grants).is_err());
    }
    #[test]
    #[cfg(unix)]
    fn archive_is_created_inside_the_picked_folder() {
        let root = tempfile::tempdir().unwrap();
        let picked = root.path().canonicalize().unwrap().join("picked");
        fs::create_dir(&picked).unwrap();
        let out = create_archive(&picked, &picked, b"<html>", b"{}").unwrap();
        assert_eq!(out.parent(), Some(picked.as_path()));
        assert_eq!(fs::read(out.join("archive.html")).unwrap(), b"<html>");
        assert_eq!(fs::read(out.join("pack.json")).unwrap(), b"{}");
        let again = create_archive(&picked, &picked, b"2", b"2").unwrap();
        assert_ne!(again, out);
    }
    #[test]
    #[cfg(unix)]
    fn attack_archive_folder_swapped_for_symlink_is_not_followed() {
        let root = tempfile::tempdir().unwrap();
        let root = root.path().canonicalize().unwrap();
        let (picked, protected) = (root.join("picked"), root.join("protected"));
        fs::create_dir(&picked).unwrap();
        fs::create_dir(&protected).unwrap();
        fs::remove_dir(&picked).unwrap();
        std::os::unix::fs::symlink(&protected, &picked).unwrap();
        assert!(create_archive(&picked, &picked, b"x", b"y").is_err());
        assert_eq!(fs::read_dir(&protected).unwrap().count(), 0);
    }
    #[test]
    #[cfg(target_os = "macos")]
    fn attack_archive_parent_swapped_for_symlink_is_detected() {
        let root = tempfile::tempdir().unwrap();
        let root = root.path().canonicalize().unwrap();
        let picked = root.join("a").join("picked");
        fs::create_dir_all(&picked).unwrap();
        let protected = root.join("b").join("picked");
        fs::create_dir_all(&protected).unwrap();
        fs::rename(root.join("a"), root.join("a-old")).unwrap();
        std::os::unix::fs::symlink(root.join("b"), root.join("a")).unwrap();
        assert!(create_archive(&picked, &picked, b"x", b"y").is_err());
        assert_eq!(fs::read_dir(&protected).unwrap().count(), 0);
    }

    #[test]
    fn attack_oversized_and_non_utf8_files_are_rejected() {
        let temp = tempfile::tempdir().unwrap();
        let dir = temp.path().canonicalize().unwrap();
        let (big, grants) = granted(&dir, "big.json", b"");
        File::options()
            .write(true)
            .open(&big)
            .unwrap()
            .set_len(LIMIT + 1)
            .unwrap();
        assert_eq!(
            read_allowed(&big, &grants).unwrap_err(),
            "Sidebar exceeds the 100 MiB limit."
        );
        let (bad, grants) = granted(&dir, "bad.json", &[0x7b, 0xff, 0xfe, 0x7d]);
        assert_eq!(
            read_allowed(&bad, &grants).unwrap_err(),
            "Choose a UTF-8 JSON file."
        );
    }
}
