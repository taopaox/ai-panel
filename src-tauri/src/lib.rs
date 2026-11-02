mod browser;

use std::sync::{Condvar, Mutex};
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::{
    menu::{
        CheckMenuItemBuilder, MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder,
        WINDOW_SUBMENU_ID,
    },
    webview::{NewWindowResponse, PageLoadEvent, WebviewBuilder},
    Emitter, EventTarget, LogicalPosition, LogicalSize, Manager, WebviewUrl,
};

const SAFARI_UA: &str =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15";

const PAGE_QUERY_JS: &str = r#"
(() => {
  let canGoBack = false;
  let canGoForward = false;
  try {
    if (window.navigation) {
      canGoBack = Boolean(window.navigation.canGoBack);
      canGoForward = Boolean(window.navigation.canGoForward);
    } else {
      canGoBack = window.history.length > 1;
    }
  } catch (e) {}
  return {
    canGoBack,
    canGoForward,
    focused: document.hasFocus(),
    title: document.title || "",
    url: location.href || ""
  };
})()
"#;

struct PopupPick {
    value: Mutex<Option<String>>,
    cond: Condvar,
}

impl PopupPick {
    fn clear(&self) -> Result<(), String> {
        *self.value.lock().map_err(|err| err.to_string())? = None;
        Ok(())
    }

    fn store(&self, id: String) {
        if let Ok(mut pick) = self.value.lock() {
            *pick = Some(id);
        }
        self.cond.notify_one();
    }

    fn take_after_menu(&self) -> Result<Option<String>, String> {
        let mut pick = self.value.lock().map_err(|err| err.to_string())?;
        if pick.is_none() {
            let (guard, _) = self
                .cond
                .wait_timeout(pick, Duration::from_millis(150))
                .map_err(|err| err.to_string())?;
            pick = guard;
        }
        Ok(pick.take())
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PageState {
    can_go_back: bool,
    can_go_forward: bool,
    focused: bool,
    title: String,
    url: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ContentPagePayload {
    label: String,
    can_go_back: bool,
    can_go_forward: bool,
    focused: bool,
    title: String,
    url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    loading: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct OpenTabPayload {
    opener_label: String,
    url: String,
    navigate: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PopupMenuItem {
    id: String,
    text: String,
    enabled: Option<bool>,
    checked: Option<bool>,
    separator: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "lowercase")]
enum NavAction {
    Back,
    Forward,
    Reload,
    Stop,
}

fn parse_page_state(json: &str) -> PageState {
    serde_json::from_str(json).unwrap_or_default()
}

fn emit_page_state(
    app: &tauri::AppHandle,
    webview: &tauri::Webview,
    label: &str,
    loading: Option<bool>,
) {
    let app = app.clone();
    let label = label.to_string();
    let _ = webview.eval_with_callback(PAGE_QUERY_JS, move |json| {
        let page = parse_page_state(&json);
        let payload = ContentPagePayload {
            label: label.clone(),
            can_go_back: page.can_go_back,
            can_go_forward: page.can_go_forward,
            focused: page.focused,
            title: page.title,
            url: page.url,
            loading,
        };
        let _ = app.emit_to(EventTarget::webview("main"), "content-page-state", payload);
    });
}

fn item(
    app: &tauri::AppHandle,
    id: &str,
    text: &str,
    accelerator: Option<&str>,
) -> tauri::Result<tauri::menu::MenuItem<tauri::Wry>> {
    let mut builder = MenuItemBuilder::with_id(id, text);
    if let Some(accelerator) = accelerator {
        builder = builder.accelerator(accelerator);
    }
    builder.build(app)
}

fn build_app_menu(app: &tauri::AppHandle) -> tauri::Result<tauri::menu::Menu<tauri::Wry>> {
    let settings = item(app, "settings", "设置…", Some("CmdOrCtrl+,"))?;
    let app_menu = SubmenuBuilder::new(app, "AiPanel")
        .about(None)
        .separator()
        .item(&settings)
        .separator()
        .hide()
        .hide_others()
        .show_all()
        .separator()
        .quit()
        .build()?;

    let edit_menu = SubmenuBuilder::new(app, "编辑")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;

    let back = item(app, "back", "后退", Some("CmdOrCtrl+["))?;
    let forward = item(app, "forward", "前进", Some("CmdOrCtrl+]"))?;
    let reload = item(app, "reload", "刷新", Some("CmdOrCtrl+R"))?;
    let stop = item(app, "stop", "停止", Some("CmdOrCtrl+."))?;
    let close_tab = item(app, "close-tab", "关闭标签", Some("CmdOrCtrl+W"))?;
    let zoom_in = item(app, "zoom-in", "放大", Some("CmdOrCtrl+="))?;
    let zoom_out = item(app, "zoom-out", "缩小", Some("CmdOrCtrl+-"))?;
    let zoom_reset = item(app, "zoom-reset", "实际大小", Some("CmdOrCtrl+0"))?;
    let copy_url = item(app, "copy-url", "复制链接", Some("CmdOrCtrl+Shift+C"))?;
    let open_browser = item(
        app,
        "open-browser",
        "在浏览器中打开",
        Some("CmdOrCtrl+Shift+O"),
    )?;
    let restore_tab = item(app, "restore-tab", "恢复关闭的标签", Some("CmdOrCtrl+Shift+T"))?;
    let next_tab = item(app, "next-tab", "下一个标签", Some("Ctrl+Tab"))?;
    let previous_tab = item(app, "previous-tab", "上一个标签", Some("Ctrl+Shift+Tab"))?;
    let find = item(app, "find", "查找页面内容…", Some("CmdOrCtrl+F"))?;
    let find_next = item(app, "find-next", "下一个匹配", Some("CmdOrCtrl+G"))?;
    let find_previous = item(app, "find-previous", "上一个匹配", Some("CmdOrCtrl+Shift+G"))?;
    let address = item(app, "address", "查看页面地址", Some("CmdOrCtrl+L"))?;
    let return_source = item(app, "return-source", "返回来源页面", None)?;
    let page_menu = SubmenuBuilder::new(app, "页面")
        .item(&back)
        .item(&forward)
        .item(&reload)
        .item(&stop)
        .separator()
        .item(&close_tab)
        .item(&restore_tab)
        .item(&next_tab)
        .item(&previous_tab)
        .item(&return_source)
        .separator()
        .item(&find)
        .item(&find_next)
        .item(&find_previous)
        .item(&address)
        .separator()
        .item(&zoom_in)
        .item(&zoom_out)
        .item(&zoom_reset)
        .separator()
        .item(&copy_url)
        .item(&open_browser)
        .build()?;

    let toggle_sidebar = item(app, "toggle-sidebar", "收起/展开侧栏", Some("CmdOrCtrl+B"))?;
    let split = item(app, "split", "向右分屏", Some("CmdOrCtrl+D"))?;
    let manage = item(app, "manage", "管理服务", Some("CmdOrCtrl+Shift+M"))?;
    let mut view_menu = SubmenuBuilder::new(app, "视图")
        .item(&toggle_sidebar)
        .item(&split)
        .separator()
        .item(&manage)
        .separator();
    for index in 1..=9 {
        let id = format!("service-{index}");
        let text = format!("切换到服务 {index}");
        let accel = format!("CmdOrCtrl+{index}");
        let entry = item(app, &id, &text, Some(&accel))?;
        view_menu = view_menu.item(&entry);
    }
    let view_menu = view_menu.build()?;

    let window_menu = SubmenuBuilder::with_id(app, WINDOW_SUBMENU_ID, "窗口")
        .minimize()
        .maximize()
        .separator()
        .fullscreen()
        .build()?;

    MenuBuilder::new(app)
        .item(&app_menu)
        .item(&edit_menu)
        .item(&page_menu)
        .item(&view_menu)
        .item(&window_menu)
        .build()
}

fn build_popup_menu(
    app: &tauri::AppHandle,
    items: &[PopupMenuItem],
) -> Result<tauri::menu::Menu<tauri::Wry>, String> {
    let mut menu = MenuBuilder::new(app);
    for item in items {
        if item.separator.unwrap_or(false) {
            menu = menu.item(
                &PredefinedMenuItem::separator(app).map_err(|err| err.to_string())?,
            );
            continue;
        }
        let enabled = item.enabled.unwrap_or(true);
        if let Some(checked) = item.checked {
            let check = CheckMenuItemBuilder::with_id(&item.id, &item.text)
                .enabled(enabled)
                .checked(checked)
                .build(app)
                .map_err(|err| err.to_string())?;
            menu = menu.item(&check);
        } else {
            let entry = MenuItemBuilder::with_id(&item.id, &item.text)
                .enabled(enabled)
                .build(app)
                .map_err(|err| err.to_string())?;
            menu = menu.item(&entry);
        }
    }
    menu.build().map_err(|err| err.to_string())
}

#[tauri::command]
async fn create_content_webview(
    app: tauri::AppHandle,
    label: String,
    url: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    if app.get_webview(&label).is_some() {
        return Ok(());
    }

    let parsed = url.parse().map_err(|err: url::ParseError| err.to_string())?;
    let window = app.get_window("main").ok_or("main window not found")?;
    let app_for_popup = app.clone();
    let label_for_popup = label.clone();
    let app_for_load = app.clone();
    let label_for_load = label.clone();
    let app_for_title = app.clone();
    let label_for_title = label.clone();

    let is_extra = label.contains("-t-");
    let init_script = format!(
        "window.__AIPANEL_EXTRA_TAB__ = {};\n{}",
        if is_extra { "true" } else { "false" },
        browser::LINK_SCRIPT
    );
    let mut builder = WebviewBuilder::new(&label, WebviewUrl::External(parsed));
    builder = builder.initialization_script(&init_script);
    let builder = builder
        .user_agent(SAFARI_UA)
        .on_new_window(move |popup_url, _features| {
            if let Some(target_url) = browser::extract_open_browser_url(&popup_url) {
                let _ = tauri_plugin_opener::open_url(target_url.as_str(), None::<&str>);
                return NewWindowResponse::Deny;
            }
            if popup_url.scheme() == "http" || popup_url.scheme() == "https" {
                let _ = app_for_popup.emit_to(
                    EventTarget::webview("main"),
                    "content-open-tab",
                    OpenTabPayload {
                        opener_label: label_for_popup.clone(),
                        url: popup_url.to_string(),
                        navigate: browser::is_login_url(&popup_url),
                    },
                );
            }
            NewWindowResponse::Deny
        })
        .on_document_title_changed(move |webview, _title| {
            emit_page_state(&app_for_title, &webview, &label_for_title, None);
        })
        .on_page_load(move |webview, payload| {
            let loading = payload.event() == PageLoadEvent::Started;
            emit_page_state(&app_for_load, &webview, &label_for_load, Some(loading));
        });

    window
        .add_child(
            builder,
            LogicalPosition::new(x, y),
            LogicalSize::new(width, height),
        )
        .map_err(|err| err.to_string())?;

    Ok(())
}

#[tauri::command]
fn navigate_content_webview(
    app: tauri::AppHandle,
    label: String,
    action: NavAction,
) -> Result<(), String> {
    let webview = app.get_webview(&label).ok_or("webview not found")?;
    match action {
        NavAction::Back => webview
            .eval("history.back()")
            .map_err(|err| err.to_string())?,
        NavAction::Forward => webview
            .eval("history.forward()")
            .map_err(|err| err.to_string())?,
        NavAction::Reload => webview.reload().map_err(|err| err.to_string())?,
        NavAction::Stop => webview
            .eval("window.stop()")
            .map_err(|err| err.to_string())?,
    }
    let loading = match action {
        NavAction::Reload => Some(true),
        NavAction::Stop => Some(false),
        _ => None,
    };
    emit_page_state(&app, &webview, &label, loading);
    Ok(())
}

#[tauri::command]
async fn content_webview_history(
    app: tauri::AppHandle,
    label: String,
) -> Result<PageState, String> {
    let webview = app.get_webview(&label).ok_or("webview not found")?;
    let (tx, rx) = std::sync::mpsc::channel();
    webview
        .eval_with_callback(PAGE_QUERY_JS, move |json| {
            let _ = tx.send(parse_page_state(&json));
        })
        .map_err(|err| err.to_string())?;

    tauri::async_runtime::spawn_blocking(move || {
        rx.recv_timeout(std::time::Duration::from_millis(800))
            .unwrap_or_default()
    })
    .await
    .map_err(|err| err.to_string())
}

#[derive(Debug, Default, Serialize, Deserialize)]
struct FindResult {
    total: usize,
    index: usize,
}

#[tauri::command]
async fn find_content_text(
    caller: tauri::Webview,
    app: tauri::AppHandle,
    label: String,
    query: String,
    direction: i32,
) -> Result<FindResult, String> {
    if caller.label() != "main" || !label.starts_with("wv-") {
        return Err("only the shell may search content pages".into());
    }
    let webview = app.get_webview(&label).ok_or("webview not found")?;
    let args = serde_json::json!({"query": query, "direction": direction.signum()});
    let script = format!("({})({})", include_str!("find.js"), args);
    let (tx, rx) = std::sync::mpsc::channel();
    webview.eval_with_callback(script, move |json| {
        let _ = tx.send(serde_json::from_str::<FindResult>(&json).map_err(|err| err.to_string()));
    }).map_err(|err| err.to_string())?;
    tauri::async_runtime::spawn_blocking(move || {
        rx.recv_timeout(Duration::from_secs(3)).map_err(|_| "页面查找超时".to_string())?
    }).await.map_err(|err| err.to_string())?
}

#[tauri::command]
fn load_content_webview(
    app: tauri::AppHandle,
    label: String,
    url: String,
) -> Result<(), String> {
    let webview = app.get_webview(&label).ok_or("webview not found")?;
    let parsed = url.parse().map_err(|err: url::ParseError| err.to_string())?;
    webview.navigate(parsed).map_err(|err| err.to_string())?;
    emit_page_state(&app, &webview, &label, Some(true));
    Ok(())
}

#[tauri::command]
fn close_content_webview(app: tauri::AppHandle, label: String) -> Result<(), String> {
    if let Some(webview) = app.get_webview(&label) {
        webview.close().map_err(|err| err.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn set_content_zoom(app: tauri::AppHandle, label: String, factor: f64) -> Result<(), String> {
    let webview = app.get_webview(&label).ok_or("webview not found")?;
    webview.set_zoom(factor).map_err(|err| err.to_string())
}

#[tauri::command]
fn popup_menu(
    app: tauri::AppHandle,
    window: tauri::Window,
    items: Vec<PopupMenuItem>,
    x: Option<f64>,
    y: Option<f64>,
) -> Result<Option<String>, String> {
    let state = app.state::<PopupPick>();
    state.clear()?;
    let menu = build_popup_menu(&app, &items)?;
    // 必须带窗口坐标走 popup_menu_at。不带坐标时 macOS 用 inView=nil，
    // 左键点击后菜单常常不出现或立刻关掉。
    if let (Some(x), Some(y)) = (x, y) {
        window
            .popup_menu_at(&menu, LogicalPosition::new(x, y))
            .map_err(|err| err.to_string())?;
    } else {
        window
            .popup_menu(&menu)
            .map_err(|err| err.to_string())?;
    }

    // 菜单选中走事件循环，不是 popUpMenu 同步返回。关掉后再短等 menu-action。
    state.take_after_menu()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .manage(PopupPick {
            value: Mutex::new(None),
            cond: Condvar::new(),
        })
        .setup(|app| {
            let menu = build_app_menu(app.handle())?;
            app.set_menu(menu)?;
            #[cfg(target_os = "macos")]
            if let Some(icon) = app.default_window_icon() {
                if let Some(window) = app.get_window("main") {
                    let _ = window.set_icon(icon.clone());
                }
            }
            Ok(())
        })
        .on_menu_event(|app, event| {
            let id = event.id().as_ref().to_string();
            if id.starts_with("popup:") {
                app.state::<PopupPick>().store(id.clone());
            }
            let _ = app.emit_to(EventTarget::webview("main"), "menu-action", id);
        })
        .invoke_handler(tauri::generate_handler![
            create_content_webview,
            navigate_content_webview,
            load_content_webview,
            content_webview_history,
            close_content_webview,
            set_content_zoom,
            find_content_text,
            popup_menu
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
