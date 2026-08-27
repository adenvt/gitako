use serde::Serialize;

/// A git ref (branch or tag) resolved to its target commit.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RefInfo {
    pub name: String,
    pub full_name: String,
    pub kind: RefKind,
    pub target: String,
    /// Commit the ref points at (or the peeled commit for tags).
    pub commit: String,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum RefKind {
    Branch,
    RemoteBranch,
    Tag,
    Head,
    Other,
}

/// Parse `git for-each-ref` output.
///
/// Expected format:
///
/// ```text
/// %(refname)%00%(objectname)%00%(objecttype)%00%(HEAD)%00%(*objectname)%00
/// ```
///
/// `%(*objectname)` holds the peeled commit for annotated tags (empty for
/// branches and lightweight tags), so tag refs resolve to their commit
/// instead of the tag object.
pub fn parse_refs(stdout: &str) -> Vec<RefInfo> {
    let mut refs = Vec::new();
    for record in stdout.split('\n') {
        let record = record.strip_suffix('\0').unwrap_or(record);
        if record.trim().is_empty() {
            continue;
        }
        let fields: Vec<&str> = record.split('\0').collect();
        if fields.len() < 5 {
            continue;
        }
        let full_name = fields[0].to_string();
        let object = fields[1].to_string();
        let object_type = fields[2];
        let is_head = fields[3] == "*";
        let peeled = fields[4];

        let (name, kind) = classify(&full_name);
        let commit = if object_type == "tag" && !peeled.is_empty() {
            peeled.to_string()
        } else {
            object.clone()
        };

        refs.push(RefInfo {
            name,
            full_name,
            kind,
            target: object,
            commit,
        });

        // Mark the current branch as Head kind when git says so.
        if is_head && kind == RefKind::Branch {
            if let Some(last) = refs.last_mut() {
                last.kind = RefKind::Head;
            }
        }
    }
    refs
}

fn classify(full_name: &str) -> (String, RefKind) {
    if let Some(name) = full_name.strip_prefix("refs/heads/") {
        (name.to_string(), RefKind::Branch)
    } else if let Some(name) = full_name.strip_prefix("refs/remotes/") {
        (name.to_string(), RefKind::RemoteBranch)
    } else if let Some(name) = full_name.strip_prefix("refs/tags/") {
        (name.to_string(), RefKind::Tag)
    } else {
        (full_name.to_string(), RefKind::Other)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_refs() -> &'static str {
        // Realistic output: lightweight tags have empty peeled field.
        "refs/heads/main\0abc123\0commit\0*\0\0\n\
         refs/heads/feature\0def456\0commit\0 \0\0\n\
         refs/remotes/origin/main\0abc123\0commit\0 \0\0\n\
         refs/tags/v1.0\0tagobj1\0tag\0 \0abc123\0\n"
    }

    #[test]
    fn parses_branches_and_tags() {
        let refs = parse_refs(sample_refs());
        assert_eq!(refs.len(), 4);

        let main = &refs[0];
        assert_eq!(main.name, "main");
        assert_eq!(main.kind, RefKind::Head);
        assert_eq!(main.commit, "abc123");

        let feature = &refs[1];
        assert_eq!(feature.name, "feature");
        assert_eq!(feature.kind, RefKind::Branch);

        let remote = &refs[2];
        assert_eq!(remote.kind, RefKind::RemoteBranch);

        let tag = &refs[3];
        assert_eq!(tag.name, "v1.0");
        assert_eq!(tag.kind, RefKind::Tag);
        // Annotated tag peeled to the commit it points at.
        assert_eq!(tag.commit, "abc123");
    }

    #[test]
    fn handles_empty_input() {
        assert!(parse_refs("").is_empty());
    }
}
