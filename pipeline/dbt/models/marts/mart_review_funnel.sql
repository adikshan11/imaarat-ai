-- System decision versus the underwriter's final decision: shows where humans overrode the engine.
select
    system_decision,
    final_decision,
    review_status,
    count(*) as assessments
from {{ ref('fct_assessments') }}
group by all
order by system_decision, final_decision
