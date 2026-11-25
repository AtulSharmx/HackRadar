import re
from pathlib import Path

ROOT = Path(__file__).parents[2]
CHECKLIST = ROOT / "docs/setup-actions-secrets.md"


def test_the_secrets_checklist_lists_exactly_the_secrets_the_workflows_read():
    """The owner adds the secrets from this doc: one a workflow reads but the doc misses is never set."""
    used = set()
    for f in (ROOT / ".github/workflows").glob("*.yml"):
        used |= set(re.findall(r"secrets\.(\w+)", f.read_text(encoding="utf-8")))
    listed = re.findall(r"^\| `(\w+)` \|", CHECKLIST.read_text(encoding="utf-8"), re.M)
    assert sorted(listed) == sorted(used)


def test_the_migration_the_checklist_says_to_apply_exists():
    names = re.findall(r"supabase/migrations/(\w+\.sql)", CHECKLIST.read_text(encoding="utf-8"))
    assert names and all((ROOT / "supabase/migrations" / n).is_file() for n in names)
