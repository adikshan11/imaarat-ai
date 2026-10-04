select
    assessment_id,
    property_id,
    assessed_at,
    city,
    state,
    cat_zone,
    seismic_zone,
    construction_type,
    occupancy_type,
    has_sprinklers,
    tiv_inr,
    risk_score,
    case
        when risk_score <= 30 then 'Accept'
        when risk_score <= 60 then 'Refer'
        when risk_score <= 84 then 'Decline (mitigation possible)'
        else 'Auto-Decline'
    end as score_band,
    system_decision,
    final_decision,
    review_status,
    review_status = 'overridden' as is_override,
    review_note,
    case when risk_flags is null or risk_flags = '' then 0 else len(string_split(risk_flags, ', ')) end as flag_count,
    risk_flags
from {{ ref('stg_submissions') }}
