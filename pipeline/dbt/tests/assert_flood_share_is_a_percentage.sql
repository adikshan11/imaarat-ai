select pincode, flood_area_pct
from {{ ref('pincode_hazard') }}
where flood_area_pct < 0 or flood_area_pct > 100
