select
    id as assessment_id,
    property_id,
    cast(created_at as timestamp) as assessed_at,
    json_extract_string(raw_input, '$.city') as city,
    json_extract_string(raw_input, '$.state') as state,
    regexp_replace(coalesce(json_extract_string(raw_input, '$.zip'), ''), '[^0-9]', '', 'g') as pincode,
    json_extract_string(raw_input, '$.construction_type') as construction_type,
    json_extract_string(raw_input, '$.occupancy_type') as occupancy_type,
    json_extract_string(raw_input, '$.cat_zone') as cat_zone,
    coalesce(json_extract_string(raw_input, '$.seismic_zone'), 'II') as seismic_zone,
    upper(json_extract_string(raw_input, '$.sprinkler_system')) = 'Y' as has_sprinklers,
    coalesce(
        try_cast(json_extract_string(raw_input, '$.total_value_at_risk_inr') as double),
        try_cast(json_extract_string(raw_input, '$.tiv') as double)
    ) as tiv_inr,
    risk_score,
    cast(decision as varchar) as system_decision,
    coalesce(cast(final_decision as varchar), cast(decision as varchar)) as final_decision,
    coalesce(cast(review_status as varchar), 'not_required') as review_status,
    cast(review_note as varchar) as review_note,
    cast(risk_flags as varchar) as risk_flags,
    cast(record_type as varchar) as record_type
from {{ source('lake', 'submissions') }}
