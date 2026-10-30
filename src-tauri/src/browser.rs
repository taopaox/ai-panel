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

pub const LINK_SCRIPT: &str = r#"
(() => {
  // Only promote explicit external anchor clicks. Redirects and form submissions
  // remain untouched, so authentication keeps its original navigation chain.
  document.addEventListener('click', event => {
    if (!event.isTrusted || event.defaultPrevented || event.button !== 0 ||
        event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.composedPath().find(node => node instanceof HTMLAnchorElement);
    if (!anchor || anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self')) return;
    let url;
    try { url = new URL(anchor.href, location.href); } catch { return; }
    if (!['http:', 'https:'].includes(url.protocol) || url.origin === location.origin) return;
    event.preventDefault();
    window.open(url.href, '_blank');
  });
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
}
