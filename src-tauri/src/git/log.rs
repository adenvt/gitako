use serde::Serialize;

/// A commit as parsed from `git log --parents --format=...`.
/// `parents` is empty for root commits.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Commit {
    pub hash: String,
    pub parents: Vec<String>,
    pub author_name: String,
    pub author_email: String,
    pub author_time: i64,
    pub subject: String,
    pub refs: Vec<String>,
}

/// Parse `git log` output into commits.
///
/// Expected format (null-separated fields, `%N` is a newline appended after
/// each record so records are newline-terminated):
///
/// ```text
/// %H%x00%P%x00%an%x00%ae%x00%at%x00%s%x00%N
/// ```
pub fn parse_log(stdout: &str) -> Vec<Commit> {
    let mut commits = Vec::new();
    for record in stdout.split('\n') {
        let record = record.strip_suffix('\0').unwrap_or(record);
        if record.trim().is_empty() {
            continue;
        }
        let fields: Vec<&str> = record.split('\0').collect();
        if fields.len() < 6 {
            continue;
        }
        let parents = if fields[1].is_empty() {
            Vec::new()
        } else {
            fields[1].split_whitespace().map(|s| s.to_string()).collect()
        };
        commits.push(Commit {
            hash: fields[0].to_string(),
            parents,
            author_name: fields[2].to_string(),
            author_email: fields[3].to_string(),
            author_time: fields[4].parse().unwrap_or(0),
            subject: fields[5].to_string(),
            refs: Vec::new(),
        });
    }
    commits
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_log() -> &'static str {
        // Merge commit (two parents), a normal commit, and a root commit.
        "abc123\0def456 fff111\0Ada\0ada@x.dev\01700000000\0Merge branch 'feature'\0\n\
         def456\0fff111\0Bob\0bob@x.dev\01690000000\0Feature work\0\n\
         fff111\0\0Cara\0cara@x.dev\01680000000\0Initial commit\0\n"
    }

    #[test]
    fn parses_commits_with_parents() {
        let commits = parse_log(sample_log());
        assert_eq!(commits.len(), 3);

        assert_eq!(commits[0].hash, "abc123");
        assert_eq!(commits[0].parents, vec!["def456", "fff111"]);
        assert_eq!(commits[0].subject, "Merge branch 'feature'");
        assert_eq!(commits[0].author_time, 1700000000);

        assert_eq!(commits[2].hash, "fff111");
        assert!(commits[2].parents.is_empty());
    }

    #[test]
    fn handles_empty_input() {
        assert!(parse_log("").is_empty());
        assert!(parse_log("\n\n").is_empty());
    }

    #[test]
    fn handles_malformed_records() {
        let commits = parse_log("onlyhash\0partial\n\0\0\0\n");
        // Malformed records are skipped.
        assert_eq!(commits.len(), 0);
    }
}
