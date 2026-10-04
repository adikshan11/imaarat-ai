select
    property_id,
    city,
    state,
    construction_type,
    occupancy_type,
    cat_zone,
    year_built,
    roof_age_years,
    square_footage,
    sprinkler_system = 'Y' as has_sprinklers,
    prior_claims_count_5yr,
    tiv as tiv_usd
from {{ source('lake', 'reference_properties') }}
