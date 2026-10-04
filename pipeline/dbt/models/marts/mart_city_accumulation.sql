-- Accumulation risk: insured value concentrated in one city can be hit by a single event.
select
    city,
    state,
    count(*) as assessments,
    sum(tiv_inr) as tiv_inr,
    max(risk_score) as max_risk_score,
    round(100.0 * sum(tiv_inr) / sum(sum(tiv_inr)) over (), 1) as portfolio_share_pct,
    rank() over (order by sum(tiv_inr) desc) as accumulation_rank
from {{ ref('fct_assessments') }}
where city is not null
group by city, state
order by accumulation_rank
