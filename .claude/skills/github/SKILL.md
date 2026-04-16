---
name: github
description: Use when working with GitHub — creating or merging PRs, managing issues, checking CI status, reviewing code, or any gh CLI operation
---

# GitHub CLI (gh)

## Pull Requests

### Create PR
```bash
gh pr create --title "title" --body "body" --base main
gh pr create --title "title" --body "body" --base main --draft
gh pr create --title "title" --body "$(cat <<'EOF'
## Summary
- bullet

## Test plan
- [ ] manual test

EOF
)"
```

### View & Status
```bash
gh pr status                     # PRs involving you
gh pr list                       # open PRs in repo
gh pr view [number|branch]       # view a PR
gh pr view --web                 # open in browser
gh pr checks [number]            # CI status for PR
```

### Review
```bash
gh pr review [number] --approve
gh pr review [number] --request-changes --body "feedback"
gh pr review [number] --comment --body "comment"
```

### Merge
```bash
gh pr merge [number] --squash --delete-branch
gh pr merge [number] --merge --delete-branch
gh pr merge [number] --rebase --delete-branch
```

### Edit / Close
```bash
gh pr edit [number] --title "new title" --body "new body"
gh pr edit [number] --add-reviewer username
gh pr edit [number] --add-label bug
gh pr close [number]
```

## Issues

```bash
gh issue create --title "title" --body "body"
gh issue create --title "title" --body "body" --label bug
gh issue list                    # open issues
gh issue list --state closed
gh issue view [number]
gh issue comment [number] --body "comment"
gh issue close [number]
gh issue close [number] --comment "closing because..."
```

## Repo

```bash
gh repo view                     # current repo info
gh repo view --web               # open in browser
gh browse                        # open repo in browser
gh browse [file]                 # open specific file on GitHub
```

## Releases

```bash
gh release list
gh release create v1.0.0 --title "v1.0.0" --notes "changelog"
gh release view v1.0.0
```

## CI / Actions

```bash
gh run list                      # recent workflow runs
gh run view [run-id]             # details of a run
gh run watch [run-id]            # stream live output
gh workflow list                 # available workflows
gh workflow run [workflow-name]  # trigger a workflow
```

## Common Patterns

**Check if PR's CI is green before merging:**
```bash
gh pr checks && gh pr merge --squash --delete-branch
```

**Create issue and link in PR body:**
```bash
# In PR body include: "Closes #123"
```

**View PR diff in terminal:**
```bash
gh pr diff [number]
```

**Check out a PR locally:**
```bash
gh pr checkout [number]
```
