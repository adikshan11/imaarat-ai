select assessment_id, risk_score
from {{ ref('fct_assessments') }}
where risk_score < 0 or risk_score > 100
