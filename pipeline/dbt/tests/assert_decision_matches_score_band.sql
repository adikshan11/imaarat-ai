-- Data contract with the application: the stored system decision must follow the score bands.
select assessment_id, risk_score, system_decision, score_band
from {{ ref('fct_assessments') }}
where system_decision <> score_band
