-- Benchmarks from the synthetic reference book, per occupancy and CAT zone.
select
    occupancy_type,
    cat_zone,
    count(*) as reference_properties,
    round(avg(roof_age_years), 1) as avg_roof_age_years,
    round(avg(prior_claims_count_5yr), 2) as avg_prior_claims,
    round(100.0 * avg(case when has_sprinklers then 1 else 0 end), 1) as sprinklered_pct,
    round(avg(tiv_usd)) as avg_tiv_usd
from {{ ref('stg_reference_properties') }}
group by occupancy_type, cat_zone
order by occupancy_type, cat_zone
