with official as (
    select * from {{ ref('pincode_hazard') }}
)

select
    s.assessment_id,
    s.property_id,
    s.pincode,
    o.pincode is not null as pincode_matched,
    o.district as official_district,
    o.state as official_state,
    s.seismic_zone as declared_seismic_zone,
    o.seismic_zone as official_seismic_zone,
    o.seismic_zone is not null
        and list_position(['II', 'III', 'IV', 'V'], o.seismic_zone) > list_position(['II', 'III', 'IV', 'V'], s.seismic_zone)
        as seismic_understated,
    o.flood_area_pct,
    coalesce(o.flood_area_pct, 0) >= 10 as flood_history,
    o.cyclone_grade,
    o.cyclone_grade in ('P1', 'P2') as cyclone_prone,
    s.tiv_inr
from {{ ref('stg_submissions') }} as s
left join official as o on o.pincode = s.pincode
