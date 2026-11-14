use serde::{Deserialize, Serialize};
use std::{
    path::{Path, PathBuf},
    process::Command,
};

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Browser {
    Chrome,
    Brave,
    Edge,
    Vivaldi,
    Opera,
    Firefox,
}
const BROWSERS: [Browser; 6] = [
    Browser::Chrome,
    Browser::Brave,
    Browser::Edge,
    Browser::Vivaldi,
    Browser::Opera,
    Browser::Firefox,
];
#[derive(Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Destination {
    Importer,
    Store,
}

#[cfg(target_os = "macos")]
pub(crate) fn executable(browser: Browser) -> Option<PathBuf> {
    let (bundle, binary) = match browser {
        Browser::Chrome => ("Google Chrome", "Google Chrome"),
        Browser::Brave => ("Brave Browser", "Brave Browser"),
        Browser::Edge => ("Microsoft Edge", "Microsoft Edge"),
        Browser::Vivaldi => ("Vivaldi", "Vivaldi"),
        Browser::Opera => ("Opera", "Opera"),
        Browser::Firefox => ("Firefox", "firefox"),
    };
    let app = format!("{bundle}.app/Contents/MacOS/{binary}");
    [
        Some(PathBuf::from("/Applications")),
        dirs::home_dir().map(|p| p.join("Applications")),
    ]
    .into_iter()
    .flatten()
    .map(|base| base.join(&app))
    .find(|p| p.is_file())
}
// Search both machine-wide and per-user Windows installations.
#[cfg(any(target_os = "windows", test))]
fn windows_candidates(browser: Browser, roots: &[PathBuf]) -> Vec<PathBuf> {
    let relative: &[&str] = match browser {
        Browser::Chrome => &["Google/Chrome/Application/chrome.exe"],
        Browser::Brave => &["BraveSoftware/Brave-Browser/Application/brave.exe"],
        Browser::Edge => &["Microsoft/Edge/Application/msedge.exe"],
        Browser::Vivaldi => &["Vivaldi/Application/vivaldi.exe"],
        Browser::Opera => &["Opera/launcher.exe", "Programs/Opera/launcher.exe"],
        Browser::Firefox => &[
            "Mozilla Firefox/firefox.exe",
            "Programs/Mozilla Firefox/firefox.exe",
        ],
    };
    roots
        .iter()
        .flat_map(|base| relative.iter().map(move |rel| base.join(rel)))
        .collect()
}
#[cfg(target_os = "windows")]
pub(crate) fn executable(browser: Browser) -> Option<PathBuf> {
    let roots: Vec<PathBuf> = [
        std::env::var_os("ProgramFiles").map(PathBuf::from),
        std::env::var_os("ProgramFiles(x86)").map(PathBuf::from),
        dirs::data_local_dir(),
    ]
    .into_iter()
    .flatten()
    .collect();
    windows_candidates(browser, &roots)
        .into_iter()
        .find(|p| p.is_file())
}
#[cfg(not(any(target_os = "macos", target_os = "windows")))]
pub(crate) fn executable(_: Browser) -> Option<PathBuf> {
    None
}

// Store-assigned IDs are filled in after publication. Never open guessed listings.
const CHROME_STORE_ID: Option<&str> = None;
const EDGE_STORE_ID: Option<&str> = None;
const FIREFOX_LISTING: Option<&str> = None;
const DEV_ID: &str = "epmcofheomfngodepcbhmmglmbekllfg";
// The downloadable extension's fixed ID (its manifest key). Checked by scripts/check-manifest.ts.
const LOCAL_ID: &str = "fbaodfmbgdgjoedphimkhagfggglpiog";
fn store_id(browser: Browser) -> Option<&'static str> {
    match browser {
        Browser::Firefox => None,
        Browser::Edge => EDGE_STORE_ID,
        _ => CHROME_STORE_ID,
    }
}
fn extension_id(browser: Browser) -> Option<&'static str> {
    // Firefox gives each install a random internal address, so it has no fixed importer URL.
    if browser == Browser::Firefox {
        return None;
    }
    store_id(browser).or(Some(if cfg!(debug_assertions) {
        DEV_ID
    } else {
        LOCAL_ID
    }))
}
fn url(browser: Browser, destination: Destination) -> Option<String> {
    match destination {
        Destination::Importer => {
            extension_id(browser).map(|id| format!("chrome-extension://{id}/importer.html"))
        }
        Destination::Store => match browser {
            Browser::Firefox => FIREFOX_LISTING.map(str::to_string),
            Browser::Edge => store_id(browser)
                .map(|id| format!("https://microsoftedge.microsoft.com/addons/detail/{id}")),
            _ => {
                store_id(browser).map(|id| format!("https://chromewebstore.google.com/detail/{id}"))
            }
        },
    }
}
pub(crate) fn profile_base(browser: Browser) -> Option<PathBuf> {
    #[cfg(target_os = "macos")]
    let path = dirs::data_dir()?.join(match browser {
        Browser::Chrome => "Google/Chrome",
        Browser::Brave => "BraveSoftware/Brave-Browser",
        Browser::Edge => "Microsoft Edge",
        Browser::Vivaldi => "Vivaldi",
        Browser::Opera => "com.operasoftware.Opera",
        Browser::Firefox => return None,
    });
    #[cfg(target_os = "windows")]
    let path = if browser == Browser::Opera {
        dirs::data_dir()?.join("Opera Software/Opera Stable")
    } else {
        dirs::data_local_dir()?.join(match browser {
            Browser::Chrome => "Google/Chrome/User Data",
            Browser::Brave => "BraveSoftware/Brave-Browser/User Data",
            Browser::Edge => "Microsoft/Edge/User Data",
            Browser::Vivaldi => "Vivaldi/User Data",
            _ => return None,
        })
    };
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    return None;
    #[cfg(any(target_os = "macos", target_os = "windows"))]
    Some(path)
}
fn has_id(path: &Path, id: &str) -> bool {
    path.join("Extensions").join(id).is_dir()
}
#[derive(Serialize)]
pub struct Detected {
    browser: Browser,
    importer_available: bool,
    store_available: bool,
}
#[tauri::command]
pub fn detect_browsers() -> Vec<Detected> {
    BROWSERS
        .into_iter()
        .filter(|b| executable(*b).is_some())
        .map(|browser| Detected {
            browser,
            importer_available: url(browser, Destination::Importer).is_some(),
            store_available: url(browser, Destination::Store).is_some(),
        })
        .collect()
}
#[tauri::command]
pub fn extension_installed(browser: Browser) -> Option<bool> {
    let id = extension_id(browser)?;
    let root = profile_base(browser)?;
    if has_id(&root, id) {
        return Some(true);
    }
    let entries = root.read_dir().ok()?;
    entries
        .flatten()
        .any(|entry| has_id(&entry.path(), id))
        .then_some(true)
}
#[tauri::command]
pub fn open_in_browser(browser: Browser, destination: Destination) -> Result<(), String> {
    let path = executable(browser).ok_or("Browser is unavailable.")?;
    let target = url(browser, destination)
        .ok_or("Open Handoff from your browser toolbar and drop the saved pack.")?;
    Command::new(path)
        .arg(target)
        .spawn()
        .map(|_| ())
        .map_err(|_| "Could not open your browser.".into())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn windows_discovery_covers_machine_and_per_user_installs() {
        let root = PathBuf::from("test-root");
        for browser in BROWSERS {
            let paths = windows_candidates(browser, std::slice::from_ref(&root));
            assert!(!paths.is_empty());
            assert!(paths
                .iter()
                .all(|p| p.starts_with(&root) && p.extension().is_some_and(|ext| ext == "exe")));
        }
        assert!(
            windows_candidates(Browser::Opera, std::slice::from_ref(&root))
                .contains(&root.join("Opera/launcher.exe"))
        );
        assert!(
            windows_candidates(Browser::Firefox, std::slice::from_ref(&root))
                .contains(&root.join("Programs/Mozilla Firefox/firefox.exe"))
        );
        assert_eq!(
            windows_candidates(Browser::Chrome, &[]),
            Vec::<PathBuf>::new()
        );
    }
    #[test]
    fn destinations_are_fixed() {
        for browser in BROWSERS {
            if let Some(uri) = url(browser, Destination::Importer) {
                assert_eq!(
                    uri,
                    format!(
                        "chrome-extension://{}/importer.html",
                        extension_id(browser).unwrap()
                    )
                )
            }
        }
        assert!(url(Browser::Firefox, Destination::Importer).is_none());
    }
    #[test]
    fn exact_extension_directory() {
        let dir = tempfile::tempdir().unwrap();
        assert!(!has_id(dir.path(), DEV_ID));
        std::fs::create_dir_all(dir.path().join("Extensions").join(DEV_ID)).unwrap();
        assert!(has_id(dir.path(), DEV_ID));
    }

    // The launcher passes exactly one argument; it must never be a flag or another scheme.
    #[test]
    fn attack_launcher_targets_are_fixed_urls() {
        let id_ok = |id: &str| id.len() == 32 && id.bytes().all(|b| (b'a'..=b'p').contains(&b));
        for browser in BROWSERS {
            for destination in [Destination::Importer, Destination::Store] {
                let Some(target) = url(browser, destination) else {
                    continue;
                };
                assert!(!target.starts_with('-'), "{target}");
                assert!(!target.chars().any(|c| c.is_whitespace() || c.is_control()));
                if let Some(rest) = target.strip_prefix("chrome-extension://") {
                    let id = rest
                        .strip_suffix("/importer.html")
                        .expect("importer page only");
                    assert!(id_ok(id), "{target}");
                } else {
                    assert!(
                        target.starts_with("https://chromewebstore.google.com/detail/")
                            || target
                                .starts_with("https://microsoftedge.microsoft.com/addons/detail/"),
                        "{target}"
                    );
                }
            }
        }
        assert!(id_ok(DEV_ID));
        assert!(id_ok(LOCAL_ID));
    }
}
