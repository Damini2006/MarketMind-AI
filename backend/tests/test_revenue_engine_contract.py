"""Locks in the revenue engine contract.

Two promises the revenue endpoints make to every caller, and that nothing else
in the suite pins down:

  1. ``/api/revenue/predict`` and ``/api/revenue/explain`` return the SAME
     number for the same input. These were once independent implementations —
     a multiplicative heuristic versus an additive breakdown — and disagreed by
     ~0.6% while the UI displayed the breakdown's figure. Arithmetic drift
     between them is invisible to a user and destroys trust in the breakdown.
  2. Each response says which engine produced it, honestly, in BOTH states of
     the deployment: ``engine="model"`` when the trained file is present, and
     ``engine="heuristic"`` when it is not. The model is not in git (it is
     gitignored, ~112 MB), so a fresh clone and an un-provisioned Railway
     service always take the second branch — and the UI used to label that
     branch "ML Model" regardless.

Why the tests force the branch instead of relying on the environment: the pkl
is absent from the repo, so the heuristic branch is the only one a fresh clone
can reach. Testing "with and without a model file" therefore needs both states
constructed on purpose. The model branch writes a real, small, fitted sklearn
pipeline and lets the REAL loader (`joblib.load` via `_get_revenue_model`) read
it — not a patched-out stub — so the load path itself is covered. The synthetic
model deliberately predicts ~0.7x the heuristic, so the two branches are
numerically distinguishable: if someone ever makes the model branch silently
return heuristic numbers, the label would be a lie and these tests catch it.
"""
import contextlib
import pathlib

import pytest

import app.ml.inference as inference

# The exact filename _get_revenue_model() resolves, derived the same way it
# does (relative to app/ml/inference.py), so the two cannot drift apart.
MODEL_PATH = (
    pathlib.Path(inference.__file__).resolve().parents[1]
    / "trained_models"
    / "revenue_prediction_compressed.pkl"
)

# Both uplift factors active. This matters: with only ONE uplift in play, the
# additive and multiplicative forms of the heuristic agree to the paisa, so a
# single-factor payload cannot see the drift this contract exists to prevent.
# (Confirmed by mutation: making the heuristic multiplicative again left a
# promotion-free payload green.) A promotion AND a non-neutral season
# compound, which is where the two forms part company.
PAYLOAD = {
    "category": "Groceries",
    "region": "South",
    "seasonality": "Summer",
    "demand": 100,
    "price": 50,
    "promotion": "Yes",
}

# The agreement assertion runs across every combination of uplifts, because
# each one exercises a different arithmetic path: both active (where the forms
# diverge), each alone (where they coincide), and neither.
AGREEMENT_PAYLOADS = {
    "promo+season": PAYLOAD,
    "promo only": {**PAYLOAD, "seasonality": "Spring"},
    "season only": {**PAYLOAD, "promotion": "No", "seasonality": "Winter"},
    "neither": {**PAYLOAD, "promotion": "No", "seasonality": "Spring"},
}

# The synthetic model is scaled down from the heuristic on purpose (see module
# docstring): a factor of 1.0 would make the two engines agree by coincidence
# and hide a mislabelled branch.
_MODEL_SCALE = 0.7


def _fit_tiny_model():
    """A really-fitted sklearn pipeline, small enough to pickle in milliseconds.

    Mirrors the shape of the real artefact — categorical columns encoded by a
    ColumnTransformer, a tree on top — because the loader under test calls
    joblib.load() on it for real. A hand-rolled stub object would pickle by
    reference and skip the very code path being exercised.
    """
    import pandas as pd
    from sklearn.compose import ColumnTransformer
    from sklearn.pipeline import Pipeline
    from sklearn.preprocessing import OneHotEncoder
    from sklearn.tree import DecisionTreeRegressor

    rows, targets = [], []
    for category in inference.CATEGORY_VALUES:
        for region in inference.REGION_VALUES:
            for season in inference.SEASONALITY_VALUES:
                for promotion in inference.PROMOTION_VALUES:
                    for demand in (10.0, 100.0, 400.0):
                        for price in (10.0, 50.0, 200.0):
                            rows.append({
                                "Category": category, "Region": region,
                                "Seasonality": season, "Demand": demand,
                                "Price": price, "Promotion": promotion,
                            })
                            uplift = 1.15 if promotion == "Yes" else 1.0
                            if season == "Winter":
                                uplift *= 1.1
                            elif season == "Summer":
                                uplift *= 1.05
                            targets.append(demand * price * uplift * _MODEL_SCALE)

    pipeline = Pipeline([
        ("prep", ColumnTransformer(
            [("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False),
              ["Category", "Region", "Seasonality", "Promotion"])],
            remainder="passthrough",
        )),
        ("reg", DecisionTreeRegressor(max_depth=8, random_state=0)),
    ])
    pipeline.fit(pd.DataFrame(rows), targets)
    return pipeline


def _ensure_model_file():
    """Make a model readable at MODEL_PATH. Returns a path to remove, or None.

    Returns None when a real artefact is already there — backing up a 112 MB
    file to test a contract would be absurd, and the real one is a better
    fixture anyway.
    """
    import joblib

    if MODEL_PATH.exists():
        return None
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(_fit_tiny_model(), MODEL_PATH)
    return MODEL_PATH


@contextlib.contextmanager
def engine_branch(engine):
    """Force the revenue engine into ``engine`` for the duration of the block.

    ``engine`` is one of:
      * ``"heuristic"`` — pretend the lookup already ran and found nothing.
        Forcing this rather than deleting a file keeps the branch testable in a
        checkout that does have the artefact.
      * ``"model"`` — ensure a real pickle exists and let the real loader read
        it (``_model_load_attempted`` reset so the load actually happens).
      * ``"ambient"`` — reset the cache and let the environment decide.

    The module's cached globals are restored afterwards, so no test can leak a
    stubbed engine into another.
    """
    saved = (inference._model, inference._model_load_attempted)
    written = None
    try:
        if engine == "model":
            written = _ensure_model_file()
            inference._model = None
            inference._model_load_attempted = False
        elif engine == "heuristic":
            inference._model = None
            inference._model_load_attempted = True
        elif engine == "ambient":
            inference._model = None
            inference._model_load_attempted = False
        else:  # pragma: no cover - guards a typo in a parametrisation
            raise ValueError(f"unknown engine branch: {engine!r}")
        yield
    finally:
        inference._model, inference._model_load_attempted = saved
        if written is not None:
            written.unlink(missing_ok=True)


def _call_both(client, headers, payload=None):
    payload = payload or PAYLOAD
    pred = client.post("/api/revenue/predict", json=payload, headers=headers)
    expl = client.post("/api/revenue/explain", json=payload, headers=headers)
    assert pred.status_code == 200, f"/predict -> {pred.status_code}: {pred.text}"
    assert expl.status_code == 200, f"/explain -> {expl.status_code}: {expl.text}"
    return pred.json(), expl.json()


# ── the contract, asserted in BOTH engine states ─────────────────────────


@pytest.mark.parametrize("engine", ["heuristic", "model"])
def test_both_endpoints_report_the_engine_that_answered(engine, client, owner_headers):
    with engine_branch(engine):
        pred, expl = _call_both(client, owner_headers)

    assert pred["engine"] == engine, (
        f"/predict answered from {pred['engine']!r} but the {engine!r} branch was forced"
    )
    assert expl["engine"] == engine, (
        f"/explain answered from {expl['engine']!r} but the {engine!r} branch was forced"
    )
    # Both endpoints must agree about which engine answered, or the page badges
    # the headline with one provenance and explains it with another.
    assert pred["engine"] == expl["engine"]


@pytest.mark.parametrize("label", list(AGREEMENT_PAYLOADS))
@pytest.mark.parametrize("engine", ["heuristic", "model"])
def test_predict_and_explain_agree_to_the_paisa(engine, label, client, owner_headers):
    """The headline number and the factor breakdown are the same number.

    Asserted exactly, not within a tolerance: both endpoints round the same
    float to 2 dp, so any difference at all is arithmetic drift between two
    implementations — which is precisely the regression this pins down, and
    the reason every uplift combination is covered above.
    """
    payload = AGREEMENT_PAYLOADS[label]
    with engine_branch(engine):
        pred, expl = _call_both(client, owner_headers, payload)

    assert pred["predicted_revenue"] == expl["predicted_revenue"], (
        f"[{engine} / {label}] /predict said {pred['predicted_revenue']} but "
        f"/explain said {expl['predicted_revenue']}"
    )


@pytest.mark.parametrize("engine", ["heuristic", "model"])
def test_explanation_factors_sum_to_the_headline(engine, client, owner_headers):
    """The bars must add up to the number printed above them."""
    with engine_branch(engine):
        _pred, expl = _call_both(client, owner_headers)

    factor_sum = round(sum(f["value"] for f in expl["factors"]), 2)
    assert expl["factors"], "an explanation with no factors is not an explanation"
    assert factor_sum == expl["predicted_revenue"], (
        f"[{engine}] factors sum to {factor_sum} but the headline is "
        f"{expl['predicted_revenue']}"
    )
    assert expl["sum_check"] == expl["predicted_revenue"]


@pytest.mark.parametrize("engine", ["heuristic", "model"])
def test_both_endpoints_report_the_same_effective_inputs(engine, client, owner_headers):
    """The normalization must not differ between the two endpoints.

    _normalize_inputs() maps free text onto the training domain; if the two
    endpoints disagreed about what was actually used, the explanation would be
    of different inputs than the prediction.
    """
    with engine_branch(engine):
        pred, expl = _call_both(client, owner_headers)

    assert pred["inputs_used"] == expl["inputs_used"], (
        f"[{engine}] inputs_used differ:\n  predict={pred['inputs_used']}\n"
        f"  explain={expl['inputs_used']}"
    )


# ── the label must not be cosmetic ───────────────────────────────────────


def test_the_two_engines_give_different_answers(client, owner_headers):
    """Guards against the engine field being a label with no branch behind it.

    If the model path ever silently returned the heuristic (or vice versa), the
    agreement tests above would still pass while the reported provenance was
    false. Here the synthetic model predicts ~0.7x the heuristic, so the two
    must differ.
    """
    with engine_branch("heuristic"):
        heuristic, _ = _call_both(client, owner_headers)
    with engine_branch("model"):
        model, _ = _call_both(client, owner_headers)

    assert heuristic["engine"] == "heuristic"
    assert model["engine"] == "model"
    assert heuristic["predicted_revenue"] != model["predicted_revenue"], (
        "the model branch returned the heuristic's number — the reported engine "
        "no longer describes how the answer was produced"
    )


def test_ambient_environment_reports_what_it_actually_has(client, owner_headers):
    """The real loader's decision, with no forcing at all.

    A fresh clone has no .pkl (it is gitignored), so this asserts the honest
    state of whatever checkout it runs in: engine must match the presence of
    the file. This is the test that would have failed back when the page
    promised "our trained ML model" on a deployment with no model.
    """
    with engine_branch("ambient"):
        pred, expl = _call_both(client, owner_headers)

    expected = "model" if MODEL_PATH.exists() else "heuristic"
    assert pred["engine"] == expected, (
        f"model file present={MODEL_PATH.exists()} at {MODEL_PATH} but /predict "
        f"reported engine={pred['engine']!r}"
    )
    assert expl["engine"] == expected
    assert pred["predicted_revenue"] == expl["predicted_revenue"]
