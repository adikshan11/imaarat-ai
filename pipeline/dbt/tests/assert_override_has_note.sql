-- Governance: every underwriter override must carry a written reason.
select assessment_id, system_decision, final_decision
from {{ ref('fct_assessments') }}
where is_override and (review_note is null or trim(review_note) = '')
