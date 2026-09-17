use serde::{Deserialize, Serialize};
use tauri::{
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
    title: document.title || "",
    url: location.href || ""
  };
})()
"#;

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PageState {
    can_go_back: bool,
    can_go_forward: bool,
    title: String,
    url: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ContentPagePayload {
    label: String,
    can_go_back: bool,
    can_go_forward: bool,
    title: String,
    url: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct OpenTabPayload {
    opener_label: String,
    url: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "lowercase")]
enum NavAction {
    Back,
    Forward,
    Reload,
}

fn parse_page_state(json: &str) -> PageState {
    serde_json::from_str(json).unwrap_or_default()
}

fn emit_page_state(app: &tauri::AppHandle, webview: &tauri::Webview, label: &str) {
    let app = app.clone();
    let label = label.to_string();
    let _ = webview.eval_with_callback(PAGE_QUERY_JS, move |json| {
        let page = parse_page_state(&json);
        let payload = ContentPagePayload {
            label: label.clone(),
            can_go_back: page.can_go_back,
            can_go_forward: page.can_go_forward,
            title: page.title,
            url: page.url,
        };
        let _ = app.emit_to(EventTarget::webview("main"), "content-page-state", payload);
    });
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

    let builder = WebviewBuilder::new(&label, WebviewUrl::External(parsed))
        .user_agent(SAFARI_UA)
        .on_new_window(move |popup_url, _features| {
            if popup_url.scheme() == "http" || popup_url.scheme() == "https" {
                let _ = app_for_popup.emit_to(
                    EventTarget::webview("main"),
                    "content-open-tab",
                    OpenTabPayload {
                        opener_label: label_for_popup.clone(),
                        url: popup_url.to_string(),
                    },
                );
            }
            NewWindowResponse::Deny
        })
        .on_document_title_changed(move |webview, _title| {
            emit_page_state(&app_for_title, &webview, &label_for_title);
        })
        .on_page_load(move |webview, payload| {
            if payload.event() == PageLoadEvent::Finished {
                emit_page_state(&app_for_load, &webview, &label_for_load);
            }
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
    }
    emit_page_state(&app, &webview, &label);
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

#[tauri::command]
fn load_content_webview(
    app: tauri::AppHandle,
    label: String,
    url: String,
) -> Result<(), String> {
    let webview = app.get_webview(&label).ok_or("webview not found")?;
    let parsed = url.parse().map_err(|err: url::ParseError| err.to_string())?;
    webview.navigate(parsed).map_err(|err| err.to_string())?;
    emit_page_state(&app, &webview, &label);
    Ok(())
}

#[tauri::command]
fn close_content_webview(app: tauri::AppHandle, label: String) -> Result<(), String> {
    if let Some(webview) = app.get_webview(&label) {
        webview.close().map_err(|err| err.to_string())?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            create_content_webview,
            navigate_content_webview,
            load_content_webview,
            content_webview_history,
            close_content_webview
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
