use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitError {
    pub kind: GitErrorKind,
    pub message: String,
    pub code: Option<i32>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum GitErrorKind {
    NotFound,
    NotARepo,
    Conflict,
    Other,
}

impl std::fmt::Display for GitError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}: {}", self.kind_label(), self.message)
    }
}

impl std::error::Error for GitError {}

impl GitError {
    pub fn new(kind: GitErrorKind, message: impl Into<String>) -> Self {
        Self {
            kind,
            message: message.into(),
            code: None,
        }
    }

    pub fn not_found(message: impl Into<String>) -> Self {
        Self::new(GitErrorKind::NotFound, message)
    }

    pub fn not_a_repo(message: impl Into<String>) -> Self {
        Self::new(GitErrorKind::NotARepo, message)
    }

    pub fn other(message: impl Into<String>) -> Self {
        Self::new(GitErrorKind::Other, message)
    }

    pub fn with_code(mut self, code: i32) -> Self {
        self.code = Some(code);
        self
    }

    fn kind_label(&self) -> &'static str {
        match self.kind {
            GitErrorKind::NotFound => "not found",
            GitErrorKind::NotARepo => "not a repository",
            GitErrorKind::Conflict => "conflict",
            GitErrorKind::Other => "git error",
        }
    }
}

impl From<std::io::Error> for GitError {
    fn from(e: std::io::Error) -> Self {
        GitError::other(format!("failed to run git: {e}"))
    }
}
