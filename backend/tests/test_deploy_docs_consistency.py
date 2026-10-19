"""The URL the README documents must be the URL the smoke gate verifies.

The production origin is written down in five places that have to agree:

  * ``README.md`` — the promise made to a reader ("Live demo: <url>");
  * ``DEPLOY.md`` — the redirect rule a reader copies for retired hosts;
  * ``.github/workflows/post-deploy-smoke.yml`` — the host the gate probes
    (``PRODUCTION_URL``, falling back to the literal in that file);
  * ``scripts/post_deploy_smoke.py`` — the same gate run by hand, and its own
    default when no ``--url`` is passed;
  * ``frontend/vercel.json`` — where the retired hostnames redirect to.

Nothing here assumes the production host ends in ``.vercel.app``. The documented
origin is whatever the "Live demo" claim points at, so moving to a custom domain
keeps the comparison intact instead of quietly exempting the one host nobody
cares about. That matters because a custom domain is exactly when a stale copy
is easiest to leave behind: the old ``*.vercel.app`` name still resolves and
still looks alive.

Rename the Vercel project, move to a custom domain, or set the
``PRODUCTION_URL`` repository variable, and the others are left stale —
silently, because nothing compared them. A stale README sends every reader to a
host that may not exist (this repo has already served a two-day-old build from a
forgotten alias), and a stale gate happily verifies a host nobody visits.

This lives in the backend suite because that suite runs on every push
(`.github/workflows/ci.yml`) and locally, with no extra wiring; it is a
repository consistency check rather than a backend behaviour test.

CI passes the repository variable through as ``PRODUCTION_URL``, which is the
value the gate uses when it is set, so a mismatch in the variable is caught too.
"""
import json
import os
import pathlib
import re
from urllib.parse import urlsplit

import pytest

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
README = REPO_ROOT / "README.md"
DEPLOY_DOC = REPO_ROOT / "DEPLOY.md"
SMOKE_WORKFLOW = REPO_ROOT / ".github" / "workflows" / "post-deploy-smoke.yml"
SMOKE_SCRIPT = REPO_ROOT / "scripts" / "post_deploy_smoke.py"
VERCEL_CONFIG = REPO_ROOT / "frontend" / "vercel.json"

# A URL, stopping at the delimiters one is wrapped in by prose, YAML and JSON:
# **bold**, 'single', "double", `backtick`, (parens), [brackets], {braces}.
URL_IN_TEXT = re.compile(r"https?://[^\s\"'`*)\]},<>]+")

# `https://your-app.vercel.app` in the setup instructions is an example, not a
# claim about where this project is deployed.
PLACEHOLDER_TOKENS = ("your-app", "your-org", "example.")

# The README's claim, either as the `## Live demo` section or as a "Live demo:"
# bullet further down (the README has both, and they must agree). Anchoring on
# the claim rather than on a host suffix is what keeps a custom domain working:
# a blanket scan of the file would also pick up badges, clone URLs and setup
# examples on unrelated hosts.
LIVE_DEMO_SECTION = re.compile(r"(?ms)^##\s+Live demo\s*$(.*?)(?=^##\s|\Z)")

# DEPLOY.md shows a reader the exact rule they should add when a host retires.
# That snippet is a copy of the real rule, so it drifts like every other copy.
REDIRECT_EXAMPLE_SECTION = re.compile(
    r"(?ms)^###\s+Retired hostnames redirect to production\s*$(.*?)(?=^##|\Z)"
)
REDIRECT_EXAMPLE_HOST = re.compile(
    r'"type"\s*:\s*"host"\s*,\s*"value"\s*:\s*"([^"]+)"'
)
REDIRECT_EXAMPLE_DESTINATION = re.compile(r'"destination"\s*:\s*"([^"]+)"')


def _origin(url: str) -> str:
    parts = urlsplit(url)
    return f"{parts.scheme.lower()}://{parts.netloc.lower()}"


def _rel(path: pathlib.Path) -> str:
    """A repo-relative path for messages, without raising for an outside path.

    An assertion message is the last place that should throw: if a path ever
    lives outside the checkout, the failure has to stay readable.
    """
    try:
        return str(path.relative_to(REPO_ROOT))
    except ValueError:
        return str(path)


def _urls(text: str) -> list:
    """Every real URL in the text, placeholders removed.

    No host filter: the production origin may be a custom domain, and callers
    that need a narrower set (the Live demo claim, the gate's fallback) scope
    their input before calling this.
    """
    urls = []
    for url in URL_IN_TEXT.findall(text):
        if any(token in url.lower() for token in PLACEHOLDER_TOKENS):
            continue
        urls.append(url.rstrip("/"))
    return urls


def _live_demo_urls(text: str) -> list:
    """The URLs a README uses to say where the live demo is."""
    urls = []
    section = LIVE_DEMO_SECTION.search(text)
    if section:
        urls.extend(_urls(section.group(1)))
    for line in text.splitlines():
        if "live demo" in line.lower():
            urls.extend(_urls(line))
    return urls


def _origin_documented_in(text: str) -> str:
    """The production origin one README's Live demo claims point at."""
    urls = _live_demo_urls(text)
    assert urls, (
        "README.md no longer documents a deployment URL, so this check has "
        "nothing to compare. Add it back (the 'Live demo' section) or delete "
        "this test along with the smoke gate it guards."
    )
    origins = sorted({_origin(url) for url in urls})
    assert len(origins) == 1, (
        f"README documents {len(origins)} different production origins, so a "
        "reader cannot tell which one is live:\n  " + "\n  ".join(origins)
    )
    return origins[0]


def documented_origin() -> str:
    """The production origin README.md tells the world to use."""
    return _origin_documented_in(README.read_text(encoding="utf-8"))


def gate_origin() -> str:
    """The origin post-deploy-smoke.yml probes when PRODUCTION_URL is unset."""
    lines = [
        line
        for line in SMOKE_WORKFLOW.read_text(encoding="utf-8").splitlines()
        if re.match(r"\s*PRODUCTION_URL:", line)
    ]
    assert lines, (
        f"{SMOKE_WORKFLOW.name} no longer sets PRODUCTION_URL, so this check no "
        "longer knows which host the gate probes."
    )
    urls = _urls(lines[0])
    assert urls, f"PRODUCTION_URL has no fallback URL to compare: {lines[0].strip()!r}"
    # The fallback is the value after `||`; anything before it is a variable name.
    return _origin(urls[-1])


def deploy_doc_redirect_example() -> tuple:
    """(retired host, destination) from DEPLOY.md's embedded redirect rule."""
    text = DEPLOY_DOC.read_text(encoding="utf-8")
    section = REDIRECT_EXAMPLE_SECTION.search(text)
    assert section, (
        f"{DEPLOY_DOC.name} no longer shows the retired-host redirect under "
        "'Retired hostnames redirect to production', so the rule a reader "
        "copies can drift from the one that ships."
    )
    host = REDIRECT_EXAMPLE_HOST.search(section.group(1))
    destination = REDIRECT_EXAMPLE_DESTINATION.search(section.group(1))
    assert host and destination, (
        f"{DEPLOY_DOC.name}'s redirect example no longer has both a host and a "
        "destination to compare."
    )
    return host.group(1), destination.group(1)


def test_readme_documents_one_production_origin():
    assert documented_origin()


def test_live_demo_origin_does_not_assume_a_vercel_host():
    """A custom domain is a production origin like any other."""
    text = (
        "# Project\n\n"
        "## Live demo\n\n"
        "**https://app.marketmind.ai** → click **Explore the demo**.\n\n"
        "## Setup\n\n"
        "Clone https://github.com/org/repo and copy "
        "https://your-app.vercel.app for the env file.\n"
    )
    assert _origin_documented_in(text) == "https://app.marketmind.ai"


def test_smoke_gate_probes_the_documented_origin():
    documented, gate = documented_origin(), gate_origin()
    assert gate == documented, (
        "The post-deploy smoke gate verifies a different host than the README "
        f"documents:\n  {_rel(README)}: {documented}\n  "
        f"{_rel(SMOKE_WORKFLOW)}: {gate}\n"
        "Update whichever one is stale, or both if the deployment moved."
    )


def test_smoke_script_default_matches_the_documented_origin():
    text = SMOKE_SCRIPT.read_text(encoding="utf-8")
    match = re.search(r'^DEFAULT_URL\s*=\s*"([^"]+)"', text, re.M)
    assert match, f"{SMOKE_SCRIPT.name} no longer defines DEFAULT_URL to compare."
    assert _origin(match.group(1)) == documented_origin(), (
        f"{_rel(SMOKE_SCRIPT)} defaults to {match.group(1)}, but "
        f"the README documents {documented_origin()}. A hand-run smoke test would "
        "verify a different host than the gate does."
    )


def test_production_url_variable_matches_the_documented_origin():
    """The repository variable wins over the workflow's fallback when it is set."""
    configured = (os.environ.get("PRODUCTION_URL") or "").strip()
    if not configured:
        pytest.skip("PRODUCTION_URL is not configured for this repository")
    assert _origin(configured) == documented_origin(), (
        f"The PRODUCTION_URL repository variable is {configured}, but the README "
        f"documents {documented_origin()}. The smoke gate probes the variable, so "
        "readers are being sent somewhere the gate never checks."
    )


def test_retired_hostnames_redirect_to_the_documented_origin():
    config = json.loads(VERCEL_CONFIG.read_text(encoding="utf-8"))
    redirects = config.get("redirects") or []
    assert redirects, (
        f"{_rel(VERCEL_CONFIG)} no longer redirects the retired "
        "hostnames, which is how a stale build was served for two days."
    )
    for rule in redirects:
        hosts = [h.get("value") for h in rule.get("has", []) if h.get("type") == "host"]
        destination = rule.get("destination", "")
        assert _origin(destination) == documented_origin(), (
            f"{_rel(VERCEL_CONFIG)} sends {hosts} to {destination}, "
            f"but the README documents {documented_origin()}. Retired hosts would "
            "land on a host the smoke gate never verifies."
        )


def test_deploy_doc_redirect_example_matches_the_real_rule():
    """The rule a reader copies out of DEPLOY.md must be the rule that ships."""
    documented = documented_origin()
    host, destination = deploy_doc_redirect_example()

    assert _origin(destination) == documented, (
        f"{_rel(DEPLOY_DOC)}'s redirect example sends {host} to "
        f"{destination}, but the README documents {documented}. A reader copying "
        "the example would redirect retired hosts to a stale origin."
    )

    config = json.loads(VERCEL_CONFIG.read_text(encoding="utf-8"))
    configured_hosts = sorted(
        {
            entry.get("value")
            for rule in config.get("redirects") or []
            for entry in rule.get("has", [])
            if entry.get("type") == "host"
        }
    )
    assert host in configured_hosts, (
        f"{_rel(DEPLOY_DOC)}'s redirect example uses {host}, but "
        f"{_rel(VERCEL_CONFIG)} only redirects "
        f"{configured_hosts}. The example is no longer a copy of a real rule."
    )


def test_smoke_gate_probes_the_retired_hostnames():
    """The runtime gate must read the same redirect rules the docs describe.

    A retired alias serving a stale build is invisible from the canonical host,
    so the smoke gate probes each retired hostname directly. That only works if
    the gate is pointed at the same ``frontend/vercel.json`` the other checks
    here read; this asserts the wiring so the two cannot drift apart.
    """
    script = SMOKE_SCRIPT.read_text(encoding="utf-8")
    assert "DEFAULT_RETIRED_HOSTS_FILE" in script and "vercel.json" in script, (
        f"{SMOKE_SCRIPT.name} no longer defaults its retired-hostname probe to "
        "frontend/vercel.json, so the gate and the documented redirect rules can disagree."
    )
    workflow = SMOKE_WORKFLOW.read_text(encoding="utf-8")
    assert "--retired-hosts-file" in workflow, (
        f"{SMOKE_WORKFLOW.name} does not pass --retired-hosts-file, so the deployed gate is not "
        "probing the retired hostnames that frontend/vercel.json declares."
    )
