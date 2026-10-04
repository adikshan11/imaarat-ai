-- How often each deterministic risk flag fires across the portfolio.
with flags as (
    select assessment_id, trim(unnest(string_split(risk_flags, ','))) as risk_flag
    from {{ ref('fct_assessments') }}
    where risk_flags is not null and risk_flags <> ''
)

select
    risk_flag,
    count(distinct assessment_id) as assessments,
    round(100.0 * count(distinct assessment_id) / (select count(*) from {{ ref('fct_assessments') }}), 1) as share_pct
from flags
group by risk_flag
order by assessments desc, risk_flag
