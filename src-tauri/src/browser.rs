//! Browser policy and page scripts. Content pages never receive shell IPC permissions.
use url::Url;

pub fn is_login_url(url: &Url) -> bool {
    let host = url.host_str().unwrap_or_default();
    if ["accounts.google.com", "login.microsoftonline.com", "login.live.com", "appleid.apple.com"]
        .contains(&host)
    {
        return true;
    }
    let path = url.path().to_ascii_lowercase();
    if path.split('/').any(|segment| {
        matches!(segment, "auth" | "oauth" | "oauth2" | "authorize" | "authorization" | "login" | "signin" | "sign-in" | "sso" | "callback")
    }) {
        return true;
    }
    let keys: Vec<_> = url.query_pairs().map(|(key, _)| key.into_owned()).collect();
    keys.iter().any(|key| key == "client_id")
        && keys.iter().any(|key| key == "redirect_uri" || key == "response_type")
}

pub fn extract_open_browser_url(popup_url: &Url) -> Option<Url> {
    if (popup_url.scheme() == "http" || popup_url.scheme() == "https")
        && popup_url.host_str() == Some("aipanel.internal")
        && popup_url.path() == "/open-browser"
    {
        for (k, v) in popup_url.query_pairs() {
            if k == "url" {
                if let Ok(target) = Url::parse(&v) {
                    if target.scheme() == "http" || target.scheme() == "https" {
                        return Some(target);
                    }
                }
            }
        }
    }
    None
}

pub const LINK_SCRIPT: &str = r#"
(() => {
  const isExtra = Boolean(window.__AIPANEL_EXTRA_TAB__);
  document.addEventListener('click', event => {
    if (!event.isTrusted || event.button !== 0) return;
    const isCmd = Boolean(event.metaKey || event.ctrlKey);
    const anchor = event.composedPath().find(node => node instanceof HTMLAnchorElement || (typeof SVGAElement !== 'undefined' && node instanceof SVGAElement));
    if (!anchor || (anchor instanceof HTMLAnchorElement && anchor.hasAttribute('download'))) return;

    const rawHref = anchor instanceof HTMLAnchorElement
      ? anchor.href
      : (anchor.href?.baseVal || anchor.getAttribute('href') || '');
    if (!rawHref) return;

    let url;
    try { url = new URL(rawHref, location.href); } catch { return; }
    if (!['http:', 'https:'].includes(url.protocol)) return;

    if (isCmd) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      window.open('http://aipanel.internal/open-browser?url=' + encodeURIComponent(url.href), '_blank');
      return;
    }

    if (isExtra) return;
    if (event.defaultPrevented || event.shiftKey || event.altKey) return;
    if (anchor instanceof HTMLAnchorElement && anchor.target && anchor.target !== '_self') return;
    if (url.origin === location.origin) return;
    event.preventDefault();
    window.open(url.href, '_blank');
  }, true);
})()
"#;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn authentication_is_distinct_from_external_articles() {
        for value in [
            "https://accounts.google.com/o/oauth2/v2/auth?client_id=abc",
            "https://auth.openai.com/authorize?client_id=abc",
            "https://claude.ai/api/auth/callback",
            "https://example.com/connect?client_id=a&redirect_uri=https%3A%2F%2Fexample.com",
        ] {
            assert!(is_login_url(&Url::parse(value).unwrap()), "{value}");
        }
        for value in [
            "https://accounts.google.com.evil.example/article",
            "https://example.com/articles/oauth-explained",
            "https://developer.mozilla.org/en-US/docs/Web/API",
        ] {
            assert!(!is_login_url(&Url::parse(value).unwrap()), "{value}");
        }
    }

    #[test]
    fn extracts_valid_open_browser_target() {
        let valid = Url::parse("http://aipanel.internal/open-browser?url=https%3A%2F%2Fgithub.com%2Ftauri-apps").unwrap();
        assert_eq!(
            extract_open_browser_url(&valid).map(|u| u.to_string()),
            Some("https://github.com/tauri-apps".into())
        );

        let non_http = Url::parse("http://aipanel.internal/open-browser?url=file%3A%2F%2Fetc%2Fpasswd").unwrap();
        assert_eq!(extract_open_browser_url(&non_http), None);

        let other = Url::parse("https://chatgpt.com/").unwrap();
        assert_eq!(extract_open_browser_url(&other), None);
    }
}
