-- Portfolio exposure by catastrophe zone: how much insured value sits in each peril zone.
select
    coalesce(cat_zone, 'Unknown') as cat_zone,
    count(*) as assessments,
    sum(tiv_inr) as tiv_inr,
    round(avg(risk_score), 1) as avg_risk_score,
    round(100.0 * count(*) filter (where final_decision in ('Decline (mitigation possible)', 'Auto-Decline')) / count(*), 1) as decline_pct
from {{ ref('fct_assessments') }}
group by 1
order by tiv_inr desc nulls last
