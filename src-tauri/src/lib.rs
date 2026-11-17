use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    Manager,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // A menu-bar / system-tray icon so the pet can always be shown,
            // brought back on screen, or quit, even if it is hard to click.
            let toggle = MenuItem::with_id(app, "toggle", "顯示 / 隱藏 Elise", true, None::<&str>)?;
            let recenter = MenuItem::with_id(app, "recenter", "回到螢幕中央", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "退出 Elise Pet", true, None::<&str>)?;
            let separator = PredefinedMenuItem::separator(app)?;
            let menu = Menu::with_items(app, &[&toggle, &recenter, &separator, &quit])?;

            let mut tray = TrayIconBuilder::with_id("elise")
                .tooltip("Elise Pet")
                .menu(&menu)
                .on_menu_event(|app, event| {
                    let window = app.get_webview_window("main");
                    match event.id.as_ref() {
                        "quit" => app.exit(0),
                        "toggle" => {
                            if let Some(window) = window {
                                if window.is_visible().unwrap_or(true) {
                                    let _ = window.hide();
                                } else {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                            }
                        }
                        "recenter" => {
                            if let Some(window) = window {
                                let _ = window.show();
                                let _ = window.center();
                            }
                        }
                        _ => {}
                    }
                });
            if let Some(icon) = app.default_window_icon() {
                tray = tray.icon(icon.clone());
            }
            tray.build(app)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Elise-pet");
}
