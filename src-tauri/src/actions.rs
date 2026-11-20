use std::{
    fs::{self, File},
    io::{Cursor, Read},
    path::{Path, PathBuf},
};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, WebviewWindow};
use tauri_plugin_dialog::DialogExt;

const MAX_FRAMES: usize = 300;
const MAX_BYTES: u64 = 100 * 1024 * 1024;
const STORAGE_ERROR: &str = "無法存取本機動作資料夾。";
const DELETE_ERROR: &str = "無法刪除這個匯入動作。";

#[derive(Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Heading {
    Front,
    Left,
    Back,
    Right,
}

impl Heading {
    const ALL: [Self; 4] = [Self::Front, Self::Left, Self::Back, Self::Right];

    fn folder(self) -> &'static str {
        match self {
            Self::Front => "front",
            Self::Left => "left",
            Self::Back => "back",
            Self::Right => "right",
        }
    }
}

#[derive(Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ActionKind {
    Gesture,
    Walk,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Metadata {
    name: String,
    kind: ActionKind,
    fps: u8,
    frame_count: usize,
}

#[derive(Serialize)]
pub struct ImportedAction {
    id: String,
    heading: Heading,
    #[serde(flatten)]
    metadata: Metadata,
    frames: Vec<PathBuf>,
}

fn actions_root(app: &AppHandle) -> Result<PathBuf, String> {
    let root = app
        .path()
        .app_local_data_dir()
        .map_err(|_| STORAGE_ERROR)?
        .join("actions");
    for heading in Heading::ALL {
        fs::create_dir_all(root.join(heading.folder())).map_err(|_| STORAGE_ERROR)?;
    }
    Ok(root)
}

fn frame_path(folder: &Path, index: usize) -> PathBuf {
    folder.join(format!("frame_{:04}.png", index + 1))
}

fn record(heading: Heading, folder: &Path, metadata: Metadata) -> ImportedAction {
    ImportedAction {
        id: folder
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .into_owned(),
        heading,
        frames: (0..metadata.frame_count)
            .map(|index| frame_path(folder, index))
            .collect(),
        metadata,
    }
}

#[tauri::command]
pub async fn list_imported_actions(app: AppHandle) -> Result<Vec<ImportedAction>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let root = actions_root(&app)?;
        let mut actions = Vec::new();
        for heading in Heading::ALL {
            let entries = fs::read_dir(root.join(heading.folder())).map_err(|_| STORAGE_ERROR)?;
            for entry in entries {
                let entry = entry.map_err(|_| STORAGE_ERROR)?;
                if !entry.file_name().to_string_lossy().starts_with("action-")
                    || !entry.file_type().is_ok_and(|kind| kind.is_dir())
                {
                    continue;
                }
                let folder = entry.path();
                let Ok(file) = File::open(folder.join("action.json")) else {
                    continue;
                };
                let Ok(metadata) = serde_json::from_reader::<_, Metadata>(file) else {
                    continue;
                };
                if !(2..=MAX_FRAMES).contains(&metadata.frame_count)
                    || !(1..=30).contains(&metadata.fps)
                {
                    continue;
                }
                let action = record(heading, &folder, metadata);
                if action.frames.iter().all(|path| path.is_file()) {
                    actions.push(action);
                }
            }
        }
        actions.sort_by(|a, b| natord::compare(&a.metadata.name, &b.metadata.name));
        Ok(actions)
    })
    .await
    .map_err(|_| STORAGE_ERROR)?
}

fn inspect_png(bytes: &[u8]) -> Result<(u32, u32), &'static str> {
    let decoder = png::Decoder::new(Cursor::new(bytes));
    let mut reader = decoder.read_info().map_err(|_| "不是有效的 PNG。")?;
    let dimensions = reader.info().size();
    if dimensions.0 > 2048 || dimensions.1 > 2048 {
        return Err("尺寸需在 2048 × 2048 以內。");
    }
    let mut decoded = vec![0; reader.output_buffer_size().ok_or("圖片尺寸過大。")?];
    reader
        .next_frame(&mut decoded)
        .map_err(|_| "無法讀取 PNG 幀。")?;
    Ok(dimensions)
}

fn copy_action(
    root: &Path,
    source: &Path,
    heading: Heading,
    kind: ActionKind,
    fps: u8,
) -> Result<ImportedAction, String> {
    let mut files = Vec::new();
    for entry in fs::read_dir(source).map_err(|_| "無法讀取選取的資料夾。")? {
        let entry = entry.map_err(|_| "無法讀取選取的資料夾。")?;
        let path = entry.path();
        if entry.file_type().is_ok_and(|kind| kind.is_file())
            && path
                .extension()
                .is_some_and(|extension| extension.eq_ignore_ascii_case("png"))
        {
            files.push((entry.file_name().to_string_lossy().into_owned(), path));
            if files.len() > MAX_FRAMES {
                return Err("單個動作最多可匯入 300 幀。".into());
            }
        }
    }
    if files.len() < 2 {
        return Err("請選擇直接放有至少 2 張 PNG 幀的資料夾。".into());
    }
    files.sort_by(|a, b| natord::compare(&a.0, &b.0).then_with(|| a.0.cmp(&b.0)));

    let direction = root.join(heading.folder());
    let staging = tempfile::Builder::new()
        .prefix(".import-")
        .tempdir_in(&direction)
        .map_err(|_| STORAGE_ERROR)?;
    let suffix = staging
        .path()
        .file_name()
        .unwrap_or_default()
        .to_string_lossy();
    let target = direction.join(format!("action-{}", suffix.trim_start_matches(".import-")));
    let mut canvas = None;
    let mut remaining = MAX_BYTES;
    for (index, (name, path)) in files.iter().enumerate() {
        let mut bytes = Vec::new();
        File::open(path)
            .map_err(|_| format!("無法讀取 {name}。"))?
            .take(remaining + 1)
            .read_to_end(&mut bytes)
            .map_err(|_| format!("無法讀取 {name}。"))?;
        if bytes.len() as u64 > remaining {
            return Err("單個動作的 PNG 總大小最多為 100 MB。".into());
        }
        remaining -= bytes.len() as u64;
        let dimensions = inspect_png(&bytes).map_err(|reason| format!("{name} {reason}"))?;
        if let Some(previous) = canvas {
            if previous != dimensions {
                return Err("同一個動作的 PNG 必須使用相同的畫布尺寸。".into());
            }
        } else {
            canvas = Some(dimensions);
        }
        fs::write(frame_path(staging.path(), index), bytes).map_err(|_| STORAGE_ERROR)?;
    }

    let metadata = Metadata {
        name: source
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .chars()
            .take(80)
            .collect(),
        kind,
        fps,
        frame_count: files.len(),
    };
    let file = File::create(staging.path().join("action.json")).map_err(|_| STORAGE_ERROR)?;
    serde_json::to_writer(file, &metadata).map_err(|_| STORAGE_ERROR)?;
    fs::rename(staging.path(), &target).map_err(|_| STORAGE_ERROR)?;
    Ok(record(heading, &target, metadata))
}

#[tauri::command]
pub async fn import_action_folder(
    app: AppHandle,
    window: WebviewWindow,
    heading: Heading,
) -> Result<Option<ImportedAction>, String> {
    let Some(selected) = app
        .dialog()
        .file()
        .set_parent(&window)
        .set_title("選擇 PNG 動作資料夾")
        .blocking_pick_folder()
    else {
        return Ok(None);
    };
    let source = selected.into_path().map_err(|_| "無法讀取選取的資料夾。")?;
    tauri::async_runtime::spawn_blocking(move || {
        copy_action(
            &actions_root(&app)?,
            &source,
            heading,
            ActionKind::Gesture,
            10,
        )
        .map(Some)
    })
    .await
    .map_err(|_| STORAGE_ERROR)?
}

fn delete_action(root: &Path, heading: Heading, id: &str) -> Result<(), &'static str> {
    if !id.strip_prefix("action-").is_some_and(|suffix| {
        !suffix.is_empty() && suffix.bytes().all(|byte| byte.is_ascii_alphanumeric())
    }) {
        return Err(DELETE_ERROR);
    }

    let parent = root.parent().ok_or(DELETE_ERROR)?;
    let direction = fs::canonicalize(parent)
        .map_err(|_| DELETE_ERROR)?
        .join("actions")
        .join(heading.folder());
    if fs::canonicalize(&direction).map_err(|_| DELETE_ERROR)? != direction {
        return Err(DELETE_ERROR);
    }

    let folder = direction.join(id);
    match fs::symlink_metadata(&folder) {
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Ok(metadata) if metadata.file_type().is_dir() => (),
        _ => return Err(DELETE_ERROR),
    }
    if fs::canonicalize(&folder).map_err(|_| DELETE_ERROR)? != folder
        || !folder.join("action.json").is_file()
    {
        return Err(DELETE_ERROR);
    }

    // Remove the action from the library in one rename, then let TempDir clean up the frames.
    let trash = tempfile::Builder::new()
        .prefix(".delete-")
        .tempdir_in(&direction)
        .map_err(|_| DELETE_ERROR)?;
    fs::rename(folder, trash.path().join(id)).map_err(|_| DELETE_ERROR)?;
    Ok(())
}

#[tauri::command]
pub async fn delete_imported_action(
    app: AppHandle,
    heading: Heading,
    id: String,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        delete_action(&actions_root(&app)?, heading, &id).map_err(str::to_owned)
    })
    .await
    .map_err(|_| STORAGE_ERROR)?
}

#[cfg(test)]
mod tests {
    use super::*;

    fn png_file(path: &Path, alpha: u8) {
        let mut encoder = png::Encoder::new(File::create(path).unwrap(), 1, 1);
        encoder.set_color(png::ColorType::Rgba);
        encoder.set_depth(png::BitDepth::Eight);
        encoder
            .write_header()
            .unwrap()
            .write_image_data(&[0, 0, 0, alpha])
            .unwrap();
    }

    #[test]
    fn imports_sorted_frames_into_the_selected_direction() {
        let root = tempfile::tempdir().unwrap();
        let source = tempfile::tempdir().unwrap();
        fs::create_dir(root.path().join("left")).unwrap();
        let first = source.path().join("frame_2.png");
        let second = source.path().join("frame_10.png");
        png_file(&second, 50);
        png_file(&first, 255);

        let action = copy_action(
            root.path(),
            source.path(),
            Heading::Left,
            ActionKind::Walk,
            20,
        )
        .unwrap();
        assert_eq!(action.frames.len(), 2);
        assert!(action.frames[0].starts_with(root.path().join("left")));
        assert_eq!(
            fs::read(&action.frames[0]).unwrap(),
            fs::read(first).unwrap()
        );
        assert_eq!(
            fs::read(&action.frames[1]).unwrap(),
            fs::read(second).unwrap()
        );
    }

    #[test]
    fn a_corrupt_frame_leaves_no_partial_import() {
        let root = tempfile::tempdir().unwrap();
        let source = tempfile::tempdir().unwrap();
        let direction = root.path().join("back");
        fs::create_dir(&direction).unwrap();
        png_file(&source.path().join("frame_1.png"), 255);
        fs::write(source.path().join("frame_2.png"), b"invalid").unwrap();
        assert!(copy_action(
            root.path(),
            source.path(),
            Heading::Back,
            ActionKind::Gesture,
            10
        )
        .is_err());
        assert_eq!(fs::read_dir(direction).unwrap().count(), 0);
    }

    #[test]
    fn requires_multiple_frames_and_deletes_only_the_library_copy() {
        let workspace = tempfile::tempdir().unwrap();
        let root = workspace.path().join("actions");
        let direction = root.join("front");
        fs::create_dir_all(&direction).unwrap();
        let source = tempfile::tempdir().unwrap();
        let first = source.path().join("frame_1.png");
        let second = source.path().join("frame_2.png");
        png_file(&first, 255);
        assert!(copy_action(
            &root,
            source.path(),
            Heading::Front,
            ActionKind::Gesture,
            10
        )
        .is_err());

        png_file(&second, 50);
        let import = || {
            copy_action(
                &root,
                source.path(),
                Heading::Front,
                ActionKind::Gesture,
                10,
            )
            .unwrap()
        };
        let action = import();
        let other = import();
        assert!(delete_action(&root, Heading::Front, "action-../elsewhere").is_err());
        delete_action(&root, Heading::Front, &action.id).unwrap();
        delete_action(&root, Heading::Front, &action.id).unwrap();
        assert!(!direction.join(action.id).exists());
        assert_eq!(fs::read_dir(direction).unwrap().count(), 1);
        assert!(other.frames.iter().all(|path| path.is_file()));
        assert!(first.is_file() && second.is_file());
    }
}
