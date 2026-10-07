import pytest
from app.schemas import decision_from_score
from app.tools.risk_calculator import risk_score_calculator
from evals.golden import golden_cases


@pytest.mark.parametrize("case", golden_cases(), ids=lambda case: case["id"])
def test_golden_case_matches_deterministic_engine(case):
    scored = risk_score_calculator(case["facts"])
    assert decision_from_score(scored["score"]) == case["expected_decision"]
    assert sorted(scored["flags"]) == sorted(case["expected_flags"])
