select pincode, urban_flood_points, urban_flood_source
from {{ ref('pincode_hazard') }}
where (urban_flood_points is null) <> (urban_flood_source is null) or urban_flood_points < 0
