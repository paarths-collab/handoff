//! Open sidebar tabs directly in a chosen Chromium profile, without an extension.
//!
//! Only the profile list (directory and display name) is read from the browser's
//! `Local State` file. Logins, cookies, history and every other field are ignored.
//! The launcher passes a fixed flag set, then `--` so no URL can become a switch.
use crate::browsers::{executable, profile_base, Browser};
use serde::Serialize;
use std::{fs::File, io::Read, path::Path, process::Command};

const LOCAL_STATE_LIMIT: u64 = 16 * 1024 * 1024;
const MAX_URLS: usize = 500;
const MAX_URL_LEN: usize = 8192;
// Chromium numbers new profiles "Profile 1", "Profile 2", ...; deleted ones leave gaps.
const PROBE_LIMIT: u32 = 200;

#[derive(Serialize, Debug, PartialEq)]
pub struct Profile {
    directory: String,
    name: String,
}

fn chromium(browser: Browser) -> bool {
    matches!(
        browser,
        Browser::Chrome | Browser::Brave | Browser::Edge | Browser::Vivaldi
    )
}

/// Chromium profile folders are "Default", "Profile N", "Guest Profile" or "System Profile".
/// Anything else, including path separators or a leading dash, is rejected.
fn safe_directory(dir: &str) -> bool {
    !dir.is_empty()
        && dir.len() <= 64
        && !dir.starts_with('-')
        && !dir.starts_with('.')
        && dir
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == ' ' || c == '_' || c == '-')
}

fn parse_profiles(local_state: &str) -> Vec<Profile> {
    let Ok(value) = serde_json::from_str::<serde_json::Value>(local_state) else {
        return Vec::new();
    };
    let Some(cache) = value
        .get("profile")
        .and_then(|p| p.get("info_cache"))
        .and_then(|c| c.as_object())
    else {
        return Vec::new();
    };
    let mut profiles: Vec<Profile> = cache
        .iter()
        .filter(|(dir, _)| {
            safe_directory(dir) && !matches!(dir.as_str(), "Guest Profile" | "System Profile")
        })
        .map(|(dir, info)| {
            let text = |key: &str| {
                info.get(key)
                    .and_then(|n| n.as_str())
                    .map(|n| {
                        n.chars()
                            .filter(|c| !c.is_control())
                            .take(80)
                            .collect::<String>()
                            .trim()
                            .to_string()
                    })
                    .filter(|n| !n.is_empty())
            };
            let label = text("name").unwrap_or_else(|| dir.clone());
            // Match Chrome's own profile menu: "Given name (profile label)".
            let person = text("gaia_given_name").or_else(|| text("gaia_name"));
            let name = match person {
                Some(p) if !p.eq_ignore_ascii_case(&label) => format!("{p} ({label})"),
                _ => label,
            };
            Profile {
                directory: dir.clone(),
                name,
            }
        })
        .collect();
    // Names can still collide; add the folder so every choice is distinct.
    let mut seen = std::collections::HashMap::<String, usize>::new();
    for p in &profiles {
        *seen.entry(p.name.to_lowercase()).or_default() += 1;
    }
    for p in &mut profiles {
        if seen[&p.name.to_lowercase()] > 1 {
            p.name = format!("{} · {}", p.name, p.directory);
        }
    }
    profiles.sort_by_key(|p| p.name.to_lowercase());
    profiles
}

/// Profile names from `Local State`, or `None` when macOS (or anything else) blocks reading it.
fn read_profiles(base: &Path) -> Option<Vec<Profile>> {
    let file = File::open(base.join("Local State")).ok()?;
    let mut text = String::new();
    file.take(LOCAL_STATE_LIMIT)
        .read_to_string(&mut text)
        .ok()?;
    let profiles: Vec<Profile> = parse_profiles(&text)
        .into_iter()
        .filter(|p| base.join(&p.directory).is_dir())
        .collect();
    (!profiles.is_empty()).then_some(profiles)
}

/// Without permission to read the browser's folder, macOS still allows checking whether a
/// known profile folder exists. Probe the standard names; the user labels them in the app.
fn probe_profiles(base: &Path) -> Vec<Profile> {
    std::iter::once("Default".to_string())
        .chain((1..=PROBE_LIMIT).map(|n| format!("Profile {n}")))
        .filter(|dir| base.join(dir).is_dir())
        .map(|dir| Profile {
            name: dir.clone(),
            directory: dir,
        })
        .collect()
}

#[derive(Serialize, Debug, PartialEq)]
pub struct ProfileList {
    profiles: Vec<Profile>,
    /// false when names could not be read and `profiles` come from folder probing.
    named: bool,
}

fn profile_list(base: &Path) -> ProfileList {
    match read_profiles(base) {
        Some(profiles) => ProfileList {
            profiles,
            named: true,
        },
        None => ProfileList {
            profiles: probe_profiles(base),
            named: false,
        },
    }
}

#[tauri::command]
pub fn list_profiles(browser: Browser) -> ProfileList {
    let empty = ProfileList {
        profiles: Vec::new(),
        named: false,
    };
    if !chromium(browser) {
        return empty;
    }
    profile_base(browser)
        .map(|base| profile_list(&base))
        .unwrap_or(empty)
}

/// Opens the Full Disk Access pane. The address is fixed; nothing from the page reaches it.
#[tauri::command]
pub fn open_privacy_settings() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    return Command::new("/usr/bin/open")
        .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles")
        .spawn()
        .map(|_| ())
        .map_err(|_| "Open System Settings → Privacy & Security → Full Disk Access.".into());
    #[cfg(not(target_os = "macos"))]
    Err("This setting is only needed on macOS.".into())
}

fn valid_url(url: &str) -> bool {
    let lower = url.get(..8).unwrap_or(url).to_ascii_lowercase();
    (lower.starts_with("https://") || lower.starts_with("http://"))
        && url.len() <= MAX_URL_LEN
        && !url.chars().any(|c| c.is_whitespace() || c.is_control())
}

fn launch_args(directory: &str, urls: &[String]) -> Result<Vec<String>, String> {
    if !safe_directory(directory) {
        return Err("Choose a browser profile from the list.".into());
    }
    // No URLs opens an empty window, so the user can see which account a profile is.
    if urls.len() > MAX_URLS {
        return Err(format!("Open at most {MAX_URLS} tabs at a time."));
    }
    if !urls.iter().all(|u| valid_url(u)) {
        return Err("Only web addresses (http and https) can be opened.".into());
    }
    let mut args = vec![
        format!("--profile-directory={directory}"),
        "--new-window".to_string(),
        // Everything after the terminator is a URL, never a switch.
        "--".to_string(),
    ];
    args.extend(urls.iter().cloned());
    Ok(args)
}

#[tauri::command]
pub fn open_in_profile(browser: Browser, profile: String, urls: Vec<String>) -> Result<(), String> {
    if !chromium(browser) {
        return Err("Choose Chrome, Brave, Edge or Vivaldi.".into());
    }
    let path = executable(browser).ok_or("Browser is unavailable.")?;
    // The profile must be one the browser itself lists right now.
    if !list_profiles(browser)
        .profiles
        .iter()
        .any(|p| p.directory == profile)
    {
        return Err("That browser profile is no longer available.".into());
    }
    let args = launch_args(&profile, &urls)?;
    Command::new(path)
        .args(args)
        .spawn()
        .map(|_| ())
        .map_err(|_| "Could not open your browser.".into())
}

#[cfg(test)]
mod tests {
    use super::*;

    const LOCAL_STATE: &str = r#"{
        "os_crypt": {"encrypted_key": "ignored"},
        "profile": {"info_cache": {
            "Default": {"name": "Personal", "user_name": "ignored"},
            "Profile 3": {"name": "Work\u0007"},
            "Profile 7": {},
            "../escape": {"name": "Bad"},
            "-flag": {"name": "Bad"},
            "Guest Profile": {"name": "Guest"}
        }}
    }"#;

    #[test]
    fn lists_only_safe_profile_names() {
        assert_eq!(
            parse_profiles(LOCAL_STATE),
            vec![
                Profile {
                    directory: "Default".into(),
                    name: "Personal".into()
                },
                Profile {
                    directory: "Profile 7".into(),
                    name: "Profile 7".into()
                },
                Profile {
                    directory: "Profile 3".into(),
                    name: "Work".into()
                },
            ]
        );
        assert!(parse_profiles("not json").is_empty());
        assert!(parse_profiles(r#"{"profile": {}}"#).is_empty());
    }

    #[test]
    fn labels_match_chromes_menu_and_stay_distinct() {
        let state = r#"{"profile": {"info_cache": {
            "Default": {"name": "Alex", "gaia_given_name": "Alex"},
            "Profile 1": {"name": "example.test", "gaia_given_name": "Sam"},
            "Profile 2": {"name": "example.test", "gaia_given_name": "Alex"},
            "Profile 3": {"name": "Work", "gaia_name": "Robin Lee"},
            "Profile 4": {"name": "Team", "gaia_given_name": "Kim"},
            "Profile 5": {"name": "Team", "gaia_given_name": "Kim"}
        }}}"#;
        let names: Vec<_> = parse_profiles(state)
            .into_iter()
            .map(|p| (p.directory, p.name))
            .collect();
        assert_eq!(
            names,
            vec![
                ("Default".to_string(), "Alex".to_string()),
                ("Profile 2".into(), "Alex (example.test)".into()),
                ("Profile 4".into(), "Kim (Team) · Profile 4".into()),
                ("Profile 5".into(), "Kim (Team) · Profile 5".into()),
                ("Profile 3".into(), "Robin Lee (Work)".into()),
                ("Profile 1".into(), "Sam (example.test)".into()),
            ]
        );
    }

    #[test]
    fn reads_only_existing_profile_folders() {
        let temp = tempfile::tempdir().unwrap();
        std::fs::write(temp.path().join("Local State"), LOCAL_STATE).unwrap();
        std::fs::create_dir(temp.path().join("Profile 3")).unwrap();
        assert_eq!(
            read_profiles(temp.path()),
            Some(vec![Profile {
                directory: "Profile 3".into(),
                name: "Work".into()
            }])
        );
        assert_eq!(read_profiles(&temp.path().join("missing")), None);
    }

    #[test]
    fn builds_terminated_arguments_for_web_urls() {
        let urls = vec![
            "https://a.test/x?y=1".to_string(),
            "HTTP://b.test/".to_string(),
        ];
        assert_eq!(
            launch_args("Profile 3", &urls).unwrap(),
            vec![
                "--profile-directory=Profile 3",
                "--new-window",
                "--",
                "https://a.test/x?y=1",
                "HTTP://b.test/",
            ]
        );
    }

    #[test]
    fn attack_launcher_rejects_flags_schemes_and_bad_profiles() {
        let ok = vec!["https://a.test/".to_string()];
        for dir in [
            "",
            "../Default",
            "Profile/1",
            "-x",
            "--user-data-dir=/tmp",
            ".hidden",
        ] {
            assert!(launch_args(dir, &ok).is_err(), "{dir}");
        }
        for url in [
            "--load-extension=/tmp/x",
            "javascript:alert(1)",
            "file:///etc/passwd",
            "chrome://settings",
            "https://a.test/ --flag",
            "https://a.test/\n--flag",
            "data:text/html,x",
        ] {
            assert!(launch_args("Default", &[url.to_string()]).is_err(), "{url}");
        }
        // An empty list is allowed and only opens a blank window in that profile.
        assert_eq!(
            launch_args("Default", &[]).unwrap(),
            vec!["--profile-directory=Default", "--new-window", "--"]
        );
        let too_many = vec!["https://a.test/".to_string(); MAX_URLS + 1];
        assert!(launch_args("Default", &too_many).is_err());
        let long = format!("https://a.test/{}", "a".repeat(MAX_URL_LEN));
        assert!(launch_args("Default", &[long]).is_err());
        assert!(!chromium(Browser::Firefox) && !chromium(Browser::Opera));
    }

    #[test]
    fn falls_back_to_probing_folders_when_names_are_unreadable() {
        let temp = tempfile::tempdir().unwrap();
        for dir in [
            "Default",
            "Profile 2",
            "Profile 15",
            "Guest Profile",
            "Profile x",
        ] {
            std::fs::create_dir(temp.path().join(dir)).unwrap();
        }
        // No readable Local State, as when macOS blocks access.
        assert_eq!(
            profile_list(temp.path()),
            ProfileList {
                profiles: ["Default", "Profile 2", "Profile 15"]
                    .map(|d| Profile {
                        directory: d.into(),
                        name: d.into()
                    })
                    .into(),
                named: false,
            }
        );
        // A readable list with names wins.
        std::fs::write(
            temp.path().join("Local State"),
            r#"{"profile":{"info_cache":{"Profile 2":{"name":"Work"}}}}"#,
        )
        .unwrap();
        let named = profile_list(temp.path());
        assert!(named.named);
        assert_eq!(named.profiles.len(), 1);
    }
}
