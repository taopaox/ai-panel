use tauri::{
    webview::{NewWindowResponse, WebviewBuilder},
    LogicalPosition, LogicalSize, Manager, WebviewUrl,
};

const SAFARI_UA: &str =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15";

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

    let builder = WebviewBuilder::new(&label, WebviewUrl::External(parsed))
        .user_agent(SAFARI_UA)
        .on_new_window(move |popup_url, _features| {
            if let Some(webview) = app_for_popup.get_webview(&label_for_popup) {
                let href = popup_url
                    .as_str()
                    .replace('\\', "\\\\")
                    .replace('\'', "\\'");
                let _ = webview.eval(&format!("window.location.href = '{href}'"));
            }
            NewWindowResponse::Deny
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
fn reload_content_webview(app: tauri::AppHandle, label: String) -> Result<(), String> {
    let webview = app.get_webview(&label).ok_or("webview not found")?;
    webview
        .eval("location.reload()")
        .map_err(|err| err.to_string())
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
            reload_content_webview,
            close_content_webview
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
